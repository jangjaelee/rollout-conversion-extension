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
  const [desiredManifest, setDesiredManifest] = useState(null);
  const [rolloutManifest, setRolloutManifest] = useState(null);
  const [serviceManifest, setServiceManifest] = useState([]);
  const [httprouteManifest, setHttprouteManifest] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState('Quick (10%, 30%, 100%)');
  const [conversionMode, setConversionMode] = useState('workloadRef');
  const [conversionStrategy, setConversionStrategy] = useState('canary');
  const [analysisTemplateManifest, setAnalysisTemplateManifest] = useState(null);
  const [enableAnalysisTemplate, setEnableAnalysisTemplate] = useState(false);
  const isRolloutManaged = useIsRolloutManagedService(resource);

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

        if (matched) {
          // Deployment일 경우에만 Rollout 변환 수행
          if (resource.kind === 'Deployment') {          
            const steps = conversionStrategy === 'canary' ? PRESETS[selectedPreset] : undefined;
            const rollout = convertDeploymentToRollout({
              deployment: matched,
              steps,
              mode: conversionMode,
              strategy: conversionStrategy
            });          

            // enableAnalysisTemplate가 true인 경우 rollout에 analysis 추가
            if (enableAnalysisTemplate) {
              const templateName = `${matched.metadata.name}-analysis-template`;
              const analysisTemplate = createAnalysisTemplate({
                name: matched.metadata.name,
                namespace: matched.metadata.namespace,
              });

              if (conversionStrategy === 'canary') {
                rollout.spec.strategy.canary.analysis = {
                  templates: [{ templateName }],
                  startingStep: 1,
                };
              } else if (conversionStrategy === 'blueGreen') {
                rollout.spec.strategy.blueGreen.prePromotionAnalysis = {
                  templates: [{ templateName }],
                };
              }

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
            const httproute = addCanaryBackendToHTTPRoute(matched);
            setHttprouteManifest(httproute);
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
  }, [resource, selectedPreset, conversionMode, conversionStrategy, enableAnalysisTemplate]);

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
            {httprouteManifest ? (
              <>
                <div className="button-group">
                  <button
                    className="copy-btn"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(yaml.dump(httprouteManifest));
                        alert('📋 Canary HTTPRoute YAML copied to clipboard!');
                      } catch (err) {
                        alert('❌ Failed to copy!');
                        console.error('Copy failed:', err);
                      }
                    }}
                  >
                    Copy
                  </button>
                  <button
                    className="download-btn"
                    onClick={() => {
                      const yamlString = yaml.dump(httprouteManifest);
                      const blob = new Blob([yamlString], { type: 'text/yaml' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `httproute-${httprouteManifest.metadata.name || 'httproute'}.yaml`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download
                  </button>
                </div>

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
                      <option key={presetName} value={presetName}>
                        {presetName}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="controls">
              <label>
                <input
                  type="checkbox"
                  checked={enableAnalysisTemplate}
                  onChange={(e) => setEnableAnalysisTemplate(e.target.checked)}
                />
                 Use AnalysisTemplate
              </label>
            </div>

            {rolloutManifest ? (
              <>
                <div className="button-group">
                  <button
                    className="copy-btn"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(yaml.dump(rolloutManifest));
                        alert('📋 Rollout YAML copied to clipboard!');
                      } catch (err) {
                        alert('❌ Failed to copy!');
                        console.error('Copy failed:', err);
                      }
                    }}
                  >
                    Copy
                  </button>

                  <button
                    className="download-btn"
                    onClick={() => {
                      const yamlString = yaml.dump(rolloutManifest);
                      const blob = new Blob([yamlString], { type: 'text/yaml' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `rollout-${rolloutManifest.metadata.name || 'rollout'}.yaml`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download
                  </button>
                </div>

                {renderYamlWithLineNumbers(yaml.dump(rolloutManifest))}
              </>
            ) : (
              <p className="warn-text">⚠️ Unable to convert to Rollout.</p>
            )}

            {enableAnalysisTemplate && analysisTemplateManifest && (
              <div className="column">
                <h4 className="subheading">Generated AnalysisTemplate</h4>
                <div className="button-group">
                  <button
                    className="copy-btn"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(yaml.dump(analysisTemplateManifest));
                        alert('📋 AnalysisTemplate YAML copied to clipboard!');
                      } catch (err) {
                        alert('❌ Failed to copy!');
                        console.error('Copy failed:', err);
                      }
                    }}
                  >
                    Copy
                  </button>
                  <button
                    className="download-btn"
                    onClick={() => {
                      const yamlString = yaml.dump(analysisTemplateManifest);
                      const blob = new Blob([yamlString], { type: 'text/yaml' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `analysistemplate-${analysisTemplateManifest.metadata.name || 'analysis-template'}.yaml`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download
                  </button>
                </div>

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