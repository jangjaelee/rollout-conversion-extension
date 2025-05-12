import * as React from 'react';
import { useEffect, useState } from 'react';
import yaml from 'js-yaml';
import './index.css';
import { PRESETS } from './utils/presets';
import { convertDeploymentToRollout } from './utils/convertDeployment';
import { duplicateServiceForCanary, useIsRolloutManagedService } from './utils/serviceDuplicate';
import { addCanaryBackendToHTTPRoute } from './utils/addCanaryToHttpRoute';
import { createAnalysisTemplate } from './utils/createAnalysisTemplate';
import { copyToClipboard, downloadYaml } from './utils/downloadCopy';
import { convertScaledObject, convertHPA } from './utils/convertAutoscalers';

// YAML + 라인 번호 출력 함수 (flex 기반)
const renderYamlWithLineNumbers = (props) => {
  const yamlString = props;
  const lines = yamlString.split('\n');

  return (
    <div className="yaml-container">

      {/* YAML with line numbers */}
      {lines.map((line, idx) => (
        <div key={idx} className="yaml-line">
        <span className="yaml-line-number">{idx + 1}</span>
        <span className="yaml-line-content">{line}</span>
        </div>
      ))}
    </div>
  );
};


// YAML copy to clipboard and download buttons 
const YamlActionButtons = ({ yamlObject, filenamePrefix }) => (
  <div className="button-group">
    <button className="copy-btn" onClick={() => copyToClipboard(yamlObject)}>
      Copy
    </button>
    <button className="download-btn" onClick={() => downloadYaml(yamlObject, filenamePrefix)}>
      Download
    </button>
  </div>
);

const RolloutConvert = ( {application, resource} ) => {
  //const { resource, application } = props;
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [desiredManifest, setDesiredManifest] = useState(null);
  const [rolloutManifest, setRolloutManifest] = useState(null);
  const [serviceManifest, setServiceManifest] = useState([]);
  const [httprouteManifest, setHttprouteManifest] = useState(null);
  const [analysisTemplateManifest, setAnalysisTemplateManifest] = useState(null);
  const [scaledObjectManifest, setScaledObjectManifest] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState('Quick (10%, 30%, 100%)');
  const [conversionMode, setConversionMode] = useState('workloadRef');
  const [conversionStrategy, setConversionStrategy] = useState('canary');
  const [enableAnalysisTemplate, setEnableAnalysisTemplate] = useState(false);
  const isRolloutManaged = useIsRolloutManagedService(resource);
  const [httpRoutes, setHttpRoutes] = useState([]);
  const [selectedHttpRoute, setSelectedHttpRoute] = useState('');
  const [duplicateCanaryBackend, setDuplicateCanaryBackend] = useState(false);
  const [isAlreadyRolloutTarget, setIsAlreadyRolloutTarget] = useState(false);
  const [hpaManifest, setHpaManifest] = useState(null);
  const [isKedaBasedHPA, setIsKedaBasedHPA] = useState(false);  
  const [selectedStableService, setSelectedStableService] = useState(''); // for Canary
  const [serviceNames, setServiceNames] = useState([]);
  const [selectedActiveService, setSelectedActiveService] = useState(''); // for Blue/Green
  const [existingRolloutName, setExistingRolloutName] = useState('');

  useEffect(() => {
    // ArgoCD Application Name 가져오기
    const appName = application?.metadata?.name;
    /*
    const labels = resource.metadata?.labels || {};
    const appName =
      labels['argocd.argoproj.io/instance'] || labels['app.kubernetes.io/instance'];
    */

    if (!appName) {
      setError('Application name not found in labels');
      setLoading(false);
      return;
    }

    // Desired Manifest 가져오기
    const fetchDesiredManifest = async () => {
      try {
        const response = await fetch(`/api/v1/applications/${appName}/manifests`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json();
        const rawManifests = data?.manifests ?? [];

        const manifests = rawManifests.map((m) =>
          typeof m === 'string' ? JSON.parse(m) : m
        );

        const matched = manifests.find(
          (m) =>
            m.apiVersion === resource.apiVersion &&
            m.kind === resource.kind &&
            m.metadata?.name === resource.metadata?.name
        );
        setDesiredManifest(matched || null);

        // 이미 Rollout으로 변환이 완료된 Deployment는 팝업 메세지 출력
        if (resource.kind === 'Deployment') {
          const existingRolloutUsingWorkloadRef = manifests.find(
            (m) =>
              m.kind === 'Rollout' &&
              m.spec?.workloadRef?.name === resource.metadata.name &&
              m.spec?.workloadRef?.kind === 'Deployment'
          );

          if (existingRolloutUsingWorkloadRef) {
            const rolloutName = existingRolloutUsingWorkloadRef.metadata?.name || 'unknown';
            //alert(`⚠️ This Deployment is already referenced by an existing Rollout: "${rolloutName}"`);
            setExistingRolloutName(rolloutName);
          }
        }

        // 우선순위: resource → matched → application (fallback)
        const targetNamespace =
          resource?.metadata?.namespace ||
          matched?.metadata?.namespace ||
          application?.spec?.destination?.namespace ||
          null;

        // targetNamespace가 있을 경우에만 필터링        
        const routes = manifests.filter((m) => m.kind === 'HTTPRoute')
          .map((m) => {
            if (!m.metadata?.namespace && targetNamespace) {
              // 메모리 상에서만 임시로 namespace 주입
              return {
                ...m,
                metadata: {
                  ...m.metadata,
                  namespace: targetNamespace,
                },
              };
            }

            return m;
        })
          .filter((m) => targetNamespace ? m.metadata.namespace === targetNamespace : true
        );
        setHttpRoutes(routes);

        const serviceNamesList = manifests
          .filter((m) =>
            m.kind === 'Service' &&
            m.metadata?.name &&
            !m.metadata.name.endsWith('-canary') &&
            !m.metadata.name.endsWith('-preview')
          )
          .map((s) => s.metadata.name);
        setServiceNames(serviceNamesList);

        if (matched) {
          // Deployment일 경우에만 Rollout 변환 수행
          if (resource.kind === 'Deployment') {          
            const steps = conversionStrategy === 'canary' ? PRESETS[selectedPreset] : undefined;

            const templateName = `${matched.metadata.name}-analysis-template`;
            const serviceFQDN =
              conversionStrategy === 'canary'
                ? selectedStableService
                  ? `${selectedStableService}.${targetNamespace}.svc.cluster.local`
                  : undefined
                : selectedActiveService
                  ? `${selectedActiveService}.${targetNamespace}.svc.cluster.local`
                  : undefined;

            const rollout = convertDeploymentToRollout({
              deployment: matched,
              steps,
              mode: conversionMode,
              strategy: conversionStrategy,
              httpRoute: selectedHttpRoute,
              namespace: targetNamespace,
              stableServiceName: selectedStableService,
              analysisEnabled: enableAnalysisTemplate,
              templateName: templateName,
              serviceFQDN: serviceFQDN,
              activeServiceName: selectedActiveService,
            });          

            // enableAnalysisTemplate가 true인 경우 rollout에 analysis 추가
            if (enableAnalysisTemplate) {
              const analysisTemplate = createAnalysisTemplate({
                name: matched.metadata.name,
                namespace: matched.metadata.namespace,
              });
              setAnalysisTemplateManifest(analysisTemplate);
            } else {
              setAnalysisTemplateManifest(null);
            }
            
            setRolloutManifest(rollout);
          }

          // Service일 경우에만 canary를 위한 Service 변환 수행
          if (resource.kind === 'Service') {
            // rollouts-pod-template-hash는 Argo Rollouts가 관리하는 Deployment가 생성한 ReplicaSet이 가진 라벨이며, Service가 selector로 가지고 있으며 ResourceTab에 표시하지 않음
            const hasRolloutSelector = matched?.spec?.selector && Object.prototype.hasOwnProperty.call(matched.spec.selector, 'rollouts-pod-template-hash');
        
            if (hasRolloutSelector) {
              setError('This Service is already managed by Argo Rollouts (has rollouts-pod-template-hash selector).');
              setLoading(false);
              return;
            }

            const { stable, canary } = duplicateServiceForCanary(matched);
            setServiceManifest([canary]);
          }

          // HTTPRoute일 경우에만 canary를 위한 rules[].backendRefs 추가 수행
          if (resource.kind === 'HTTPRoute') {
            const { updatedRoute, duplicate } = addCanaryBackendToHTTPRoute(matched);
            setHttprouteManifest(updatedRoute);
            setDuplicateCanaryBackend(duplicate);
          }

          // ScaledObject일 경우에만 sacleTargetRef의 kind를 변경
          if (resource.kind === 'ScaledObject') {
            const { converted, isAlreadyRolloutTarget } = convertScaledObject(matched);
            
            setIsAlreadyRolloutTarget(isAlreadyRolloutTarget);
            
            if (!isAlreadyRolloutTarget && converted) {
              setScaledObjectManifest(converted);
            }
          }

          // HorizontalPodAutoscaler일 경우에만 sacleTargetRef의 kind를 변경
          if (resource.kind === 'HorizontalPodAutoscaler') {
            const { converted, isKedaBased } = convertHPA(matched);

            setIsKedaBasedHPA(isKedaBased);

            if (!isKedaBased && converted) {
              setHpaManifest(converted);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching desired manifest:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDesiredManifest();
  }, [
    resource,
    selectedPreset,
    conversionMode,
    conversionStrategy,
    enableAnalysisTemplate,
    selectedHttpRoute,
    duplicateCanaryBackend,
    selectedStableService,
    selectedActiveService,
  ]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="error-text">❌ {error}</p>;

  if (resource.kind === 'Service') {
    return (
      <div className="section">
        <h3>Kubernetes Service YAML</h3>
        <div className="conversion-wrapper">
          <div className="column">
            <h4 className="subheading">Desired Service</h4>
            {desiredManifest ? renderYamlWithLineNumbers(yaml.dump(desiredManifest)) : <p className="warn-text">⚠️ No matching Service found.</p>}
          </div>

          <div className="column">
            <h4 className="subheading">Converted Service</h4>

            {isRolloutManaged ? (
              <p className="warn-text">⚠️ This Service is already managed by Argo Rollouts (has rollouts-pod-template-hash selector).</p>
            ) : serviceManifest.length > 0 ? (
              <>
                <YamlActionButtons yamlObject={serviceManifest[0]} filenamePrefix="service" />
                {renderYamlWithLineNumbers(yaml.dump(serviceManifest[0]))}
              </>
            ) : (
              <p className="warn-text">⚠️ Unable to convert to Service.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (resource.kind === 'HTTPRoute') {
    return (
      <div className="section">
        <h3>Kubernetes Gateway API HTTPRoute YAML</h3>
        <div className="conversion-wrapper">
          <div className="column">
            <h4 className="subheading">Desired HTTPRoute</h4>
            {desiredManifest ? renderYamlWithLineNumbers(yaml.dump(desiredManifest)) : <p className="warn-text">⚠️ No matching HTTPRoute found.</p>}
          </div>

          <div className="column">
            <h4 className="subheading">Converted HTTPRoute</h4>
            {duplicateCanaryBackend ? (
              <p className="warn-text">⚠️ The Canary backend already exists in HTTPRoute.</p>
            ) : httprouteManifest ? (
              <>
                <YamlActionButtons yamlObject={httprouteManifest} filenamePrefix="httproute" />
                {renderYamlWithLineNumbers(yaml.dump(httprouteManifest))}
              </>
            ) : (
              <p className="warn-text">⚠️ Unable to convert to HTTPRoute.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (resource.kind === 'ScaledObject') {
    return (
      <div className="section">
        <h3>KEDA ScaledObject YAML</h3>
        <div className="conversion-wrapper">
          <div className="column">
            <h4 className="subheading">Original ScaledObject</h4>
            {desiredManifest ? renderYamlWithLineNumbers(yaml.dump(desiredManifest)) : <p className="warn-text">⚠️ No matching ScaledObject found.</p>}
          </div>
  
          <div className="column">
            <h4 className="subheading">Converted ScaledObject</h4>
            { isAlreadyRolloutTarget ? (
                <p className="warn-text">⚠️ This ScaledObject is already targeting a Rollout.</p>            
            ) : scaledObjectManifest ? (
              <>
                <YamlActionButtons yamlObject={scaledObjectManifest} filenamePrefix="scaledobject" />
                {renderYamlWithLineNumbers(yaml.dump(scaledObjectManifest))}
              </>
            ) : (
              <p className="warn-text">⚠️ Unable to convert to Rollout-targeted ScaledObject.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (resource.kind === 'HorizontalPodAutoscaler') {
    return (
      <div className="section">
        <h3>Horizontal Pod Autoscaler (HPA) YAML</h3>
        <div className="conversion-wrapper">
          <div className="column">
            <h4 className="subheading">Original HPA</h4>
            {desiredManifest ? renderYamlWithLineNumbers(yaml.dump(desiredManifest)) : <p className="warn-text">⚠️ No matching HPA found.</p>}
          </div>
  
          <div className="column">
            <h4 className="subheading">Converted HPA</h4>
            {isKedaBasedHPA ? (
              <p className="warn-text">⚠️ This HPA is managed by KEDA (conversion disabled).</p>
            ) : hpaManifest ? (
              <>
                <YamlActionButtons yamlObject={hpaManifest} filenamePrefix="hpa" />
                {renderYamlWithLineNumbers(yaml.dump(hpaManifest))}
              </>
            ) : (
              <p className="warn-text">⚠️ Unable to convert HPA to Rollout target.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (resource.kind === 'Deployment') {
    return (
      <div className="section">
        <h3>Kubernetes Deployment to Argo Rollout Conversion</h3>
        <div className="conversion-wrapper">
          <div className="column">
            <h4 className="subheading">Desired Deployment</h4>
            {desiredManifest ? renderYamlWithLineNumbers(yaml.dump(desiredManifest)) : <p className="warn-text">⚠️ No matching Deployment found.</p>}
          </div>

          <div className="column">
            <h4 className="subheading">Converted Rollout</h4>

            {existingRolloutName && (
              <p className="warn-text">
                ⚠️ This Deployment is already referenced by an existing Rollout: <strong>{existingRolloutName}</strong>
              </p>
            )}

            <div className="controls">
              <label htmlFor="strategy">Conversion Strategy:</label>
              <select id="strategy" value={conversionStrategy} onChange={(e) => setConversionStrategy(e.target.value)}>
                <option value="canary">Canary</option>
                <option value="blueGreen">BlueGreen</option>
              </select>
            </div>

            <div className="controls">
              <label htmlFor="mode">Conversion Mode:</label>
              <select id="mode" value={conversionMode} onChange={(e) => setConversionMode(e.target.value)}>
                <option value="template">Classic (with template)</option>
                <option value="workloadRef">WorkloadRef (reference Deployment)</option>
              </select>
            </div>

            {conversionStrategy === 'canary' && (
              <>
                <div className="controls">
                  <label htmlFor="preset">Canary Preset:</label>
                  <select id="preset" value={selectedPreset} onChange={(e) => setSelectedPreset(e.target.value)}>
                    {Object.keys(PRESETS).map((presetName) => (
                      <option key={presetName} value={presetName}>{presetName}</option>
                    ))}
                  </select>
                </div>

                <div className="controls">
                  <label htmlFor="stableService">Stable Service:</label>
                  <select id="stableService" value={selectedStableService} onChange={(e) => setSelectedStableService(e.target.value)}>
                    <option value="">Select Service</option>
                      {serviceNames.map((svc) => (
                        <option key={svc} value={svc}>{svc}</option>
                      ))}
                    </select>
                </div>

                <div className="controls">
                  <label htmlFor="httpRoute">HTTPRoute:</label>
                  <select id="httpRoute" value={selectedHttpRoute} onChange={(e) => setSelectedHttpRoute(e.target.value)}>
                    <option value="">Select HTTPRoute</option>
                    {httpRoutes.map((route) => (
                      <option key={route.metadata.name} value={route.metadata.name}>{route.metadata.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {conversionStrategy === 'blueGreen' && (
              <div className="controls">
                <label htmlFor="activeService">Active Service:</label>
                <select id="activeService" value={selectedActiveService} onChange={(e) => setSelectedActiveService(e.target.value)}>
                  <option value="">Select Service</option>
                  {serviceNames.map((svc) => (
                    <option key={svc} value={svc}>{svc}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="controls">
              <label>
                <input
                  type="checkbox"
                  checked={enableAnalysisTemplate}
                  onChange={(e) => {
                    const isChecked = e.target.checked;

                    if (isChecked) {
                      if ((conversionStrategy === 'canary' && !selectedStableService) || (conversionStrategy === 'blueGreen' && !selectedActiveService)) {
                        alert('⚠️ Please select a required Service before enabling AnalysisTemplate.');
                        return;
                      }
                    }

                    setEnableAnalysisTemplate(isChecked);
                  }}
                />
                 Use AnalysisTemplate
              </label>
            </div>

            {rolloutManifest ? (
              <>
                <YamlActionButtons yamlObject={rolloutManifest} filenamePrefix="rollout" />
                {renderYamlWithLineNumbers(yaml.dump(rolloutManifest))}
              </>
            ) : (
              <p className="warn-text">⚠️ Unable to convert to Rollout.</p>
            )}

            {enableAnalysisTemplate && analysisTemplateManifest && (
              <div className="column">
                <h4 className="subheading">Generated AnalysisTemplate</h4>
                <YamlActionButtons yamlObject={analysisTemplateManifest} filenamePrefix="analysistemplate" />
                {renderYamlWithLineNumbers(yaml.dump(analysisTemplateManifest))}
              </div>
            )}

          </div>
        </div>
      </div>
    );
  }
};

export default RolloutConvert; 