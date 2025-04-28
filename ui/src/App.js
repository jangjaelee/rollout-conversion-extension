import * as React from 'react';
import { useEffect, useState } from 'react';
import yaml from 'js-yaml';
import './index.css';

const PRESETS = {
    'Quick (10%, 30%, 100%)': [
      { setWeight: 10 },
      { pause: { duration: '30s' } },
      { setWeight: 30 },
      { pause: { duration: '1m' } },
      { setWeight: 100 },
    ],
    'Balanced (10%, 30%, 60%, 100%)': [
      { setWeight: 10 },
      { pause: { duration: '1m' } },
      { setWeight: 30 },
      { pause: { duration: '2m' } },
      { setWeight: 60 },
      { pause: { duration: '2m' } },
      { setWeight: 100 },
    ],
    'SRE Recommend (10%, 25%, 50%, 75%, 100%)': [
      { setWeight: 10 },
      { pause: { duration: '1m' } },
      { setWeight: 25 },
      { pause: { duration: '2m' } },
      { setWeight: 50 },
      { pause: { duration: '3m' } },
      { setWeight: 75 },
      { pause: { duration: '3m' } },
      { setWeight: 100 },
    ],
    'Progressive Safe (5%, 10%, 25%, 50%, 100%)': [
      { setWeight: 5 },
      { pause: { duration: '2m' } },
      { setWeight: 10 },
      { pause: { duration: '2m' } },
      { setWeight: 25 },
      { pause: { duration: '2m' } },
      { setWeight: 50 },
      { pause: { duration: '3m' } },
      { setWeight: 100 },      
    ],
    'Rapid Majority (10% → 100%)': [
      { setWeight: 10 },
      { pause: { duration: '1m' } },
      { setWeight: 100 },
    ],    
  };


// Rollout API Template
const convertDeploymentToRollout = ({ deployment, steps, mode }) => {
  //const { deployment, steps } = props;
  if (!deployment || !steps) return null;

  const rolloutCanaryTemplate = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Rollout',
    metadata: {
      name: deployment.metadata.name,
      namespace: deployment.metadata.namespace,
      labels: deployment.metadata.labels,
      annotations: deployment.metadata.annotations,
    },
    spec: {
      replicas: deployment.spec.replicas,
      revisionHistoryLimit: deployment.spec.revisionHistoryLimit,
      strategy: {
        canary: {
          canaryService: 'canary-service',
          stableService: 'stable-service',
          canaryMetadata: {
            annotations: {
              role: 'canary',
            },
            labels: {
              role: 'canary',
            },
          },
          stableMetadata: {
            annotations: {
              role: 'stable',
            },
            labels: {
              role: 'stable',
            },
          },
          steps: steps,
        },
        trafficRouting: {
          plugins: {
            'argoproj-labs/gatewayAPI': {
              httpRoute: 'claim-api-test-public',
              namespace: 'dev-claim',
            },
          },
        },
        abortScaleDownDelaySeconds: 30,
        dynamicStableScale: false,
      },
      selector: deployment.spec.selector,
    },
  };

  if (mode === 'workloadRef') {

    rolloutCanaryTemplate.spec.workloadRef = {
        apiVersion: deployment.apiVersion,
        kind: deployment.kind,
        name: deployment.metadata.name,
        scaleDown: "onsuccess",
    };
  } else {
    //rolloutCanaryTemplate.spec.selector = deployment.spec.selector;
    rolloutCanaryTemplate.spec.template = deployment.spec.template;
  }

  return rolloutCanaryTemplate;
};


const duplicateServiceForCanary = (service) => {
  if (!service) return { stable: null, canary: null };

  const stable = { ...service };

  const canary = {
    apiVersion: service.apiVersion,
    kind: service.kind,
    metadata: {
      ...service.metadata,
      name: `${service.metadata.name}-canary`,
    },
    spec: {
      ...service.spec,
    },
  };

  return { stable, canary };
};


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


const RolloutConvert = ( {application, resource} ) => {
  //const { resource, application } = props;
  const [desiredManifest, setDesiredManifest] = useState(null);
  const [rolloutManifest, setRolloutManifest] = useState(null);
  const [serviceManifest, setServiceManifest] = useState([]);  
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState('Quick (10%, 30%, 100%)');
  const [conversionMode, setConversionMode] = useState('workloadRef'); 

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
746298
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
            const steps = PRESETS[selectedPreset];
            const rollout = convertDeploymentToRollout({ deployment: matched, steps, mode: conversionMode });          
            setRolloutManifest(rollout);          
          }
          // Service일 경우에만 canary를 위한 Service 변환 수행
          if (resource.kind === 'Service') {
            const { stable, canary } = duplicateServiceForCanary(matched);
            setServiceManifest([stable, canary]);
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
  }, [resource, selectedPreset, conversionMode]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="error-text">❌ {error}</p>;

  if (resource.kind === 'Service') {
    return (
      <div className="section">
        <h3>Kubernetes Service YAML</h3>
        {desiredManifest ? renderYamlWithLineNumbers(yaml.dump(desiredManifest)) : <p className="warn-text">⚠️ No matching Service found.</p>}


        {serviceManifest.length > 0 && (
        <>
          <h4 className="subheading">Converted</h4>
          {serviceManifest.map((m, idx) => (
            <div key={idx} style={{ marginBottom: '20px' }}>
              <div className="button-group">
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(yaml.dump(m));
                    alert('Copied to clipboard!');
                  }}
                >
                  Copy YAML
                </button>
              </div>
              {renderYamlWithLineNumbers(yaml.dump(m))}
            </div>
          ))}
        </>
      )}
      </div>
    );
  }

  if (resource.kind === 'HTTPRoute') {
    return (
      <div className="section">
        <h3>Kubernetes Gateway API HTTPRoute YAML</h3>
        {desiredManifest ? renderYamlWithLineNumbers(yaml.dump(desiredManifest)) : <p className="warn-text">⚠️ No matching HTTPRoute found.</p>}
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
              <label htmlFor="mode">Conversion Mode:</label>
              <select id="mode" value={conversionMode} onChange={(e) => setConversionMode(e.target.value)}>
                <option value="template">Classic (with template)</option>
                <option value="workloadRef">WorkloadRef (reference Deployment)</option>
              </select>
            </div>

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
          </div>
        </div>
      </div>
    );
  }
};

export default RolloutConvert; 