import * as React from 'react';
import { useEffect, useState } from 'react';
import yaml from 'js-yaml';
import './index.css';


const PRESETS = {
    'Quick (10%, 50%)': [
      { setWeight: 10 },
      { pause: { duration: '30s' } },
      { setWeight: 50 },
      { pause: { duration: '1m' } },
    ],
    'Slow (10%, 30%, 50%)': [
      { setWeight: 10 },
      { pause: { duration: '1m' } },
      { setWeight: 30 },
      { pause: { duration: '2m' } },
      { setWeight: 50 },
      { pause: { duration: '3m' } },
    ],
    'Full (10% → 100%)': [
      { setWeight: 10 },
      { pause: { duration: '1m' } },
      { setWeight: 30 },
      { pause: { duration: '2m' } },
      { setWeight: 50 },
      { pause: { duration: '2m' } },
      { setWeight: 100 },
    ],
  };


// Rollout API Template
const convertDeploymentToRollout = ({ deployment, steps, mode }) => {
  //const { deployment, steps } = props;

  if (!deployment || !steps) return null;

  const rolloutTemplate = {
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
          steps: steps,
        },
      },
    },
  };

  if (mode === 'workloadRef') {
    rolloutTemplate.spec.workloadRef = {
        apiVersion: deployment.apiVersion,
        kind: deployment.kind,
        name: deployment.metadata.name,
        scaleDown: "onsuccess",
    };
  } else {
    rolloutTemplate.spec.selector = deployment.spec.selector;
    rolloutTemplate.spec.template = deployment.spec.template;
  }

  return rolloutTemplate;
};


// YAML + 라인 번호 출력 함수 (flex 기반)
const renderYamlWithLineNumbers = (props) => {
  const yamlString = props;
  const lines = yamlString.split('\n');

  return (
    <div
      style={{
        background: '#1e1e1e',
        padding: '1rem',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '14px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowX: 'auto',
        position: 'relative',
        color: '#ddd',
      }}
    >

      {/* YAML with line numbers */}
      {lines.map((line, idx) => (
        <div key={idx} style={{ display: 'flex' }}>
          <span style={{
            width: '3em',
            textAlign: 'right',
            paddingRight: '1em',
            color: '#FFFF00',
            userSelect: 'none',
          }}>
            {idx + 1}
          </span>
          <span style={{ flex: 1 }}>{line}</span>
        </div>
      ))}
    </div>
  );
};


const RolloutConvert = ( {application, resource} ) => {
  //const { resource, application } = props;
  const [desiredManifest, setDesiredManifest] = useState(null);
  const [rolloutManifest, setRolloutManifest] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState('Quick (10%, 50%)');
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
          const steps = PRESETS[selectedPreset];
          const rollout = convertDeploymentToRollout({ deployment: matched, steps, mode: conversionMode });          
          setRolloutManifest(rollout);          
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