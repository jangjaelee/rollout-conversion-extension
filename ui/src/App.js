import * as React from 'react';
import { useEffect, useState } from 'react';
import yaml from 'js-yaml';

// Rollout API Template
const convertDeploymentToRollout = (props) => {
  const deployment = props;

  if (!deployment) return null;

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
      selector: deployment.spec.selector,
      template: deployment.spec.template,
      strategy: {
        canary: {
          steps: [
            { setWeight: 20 },
            { pause: { duration: '30s' } },
            { setWeight: 50 },
            { pause: { duration: '60s' } },
          ],
        },
      },
    },
  };

  return rolloutTemplate;
};


// YAML + 라인 번호 출력 함수 (flex 기반)
const renderYamlWithLineNumbers = (props) => {

  const yamlString = props;
  const lines = yamlString.split('\n');

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(yamlString);
      alert('📋 YAML copied to clipboard!');
    } catch (err) {
      alert('❌ Failed to copy!');
      console.error('Copy failed:', err);
    }
  };

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

    {/* Light mode style
    <div
      style={{
        background: '#f0f0f0',
        padding: '1rem',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '14px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowX: 'auto',
        position: 'relative',        
      }}
    >*/}

    {/* Dark mode style */}
            
      {/* Copy Button
      <button
        onClick={copyToClipboard}
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          padding: '0.3rem 0.6rem',
          fontSize: '12px',
          borderRadius: '4px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Copy
      </button>
      */}

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
          const rollout = convertDeploymentToRollout(matched);
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
  }, [resource]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: 'red' }}>❌ {error}</p>;

  return (
    <div style={{ width: '100%', color: '#eee' }}>
      <h3 style={{ color: '#000000' }}>Kubernetes Deployment → Argo Rollout 변환 비교</h3>
      <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ color: '#6E6E6E' }}>Desired Deployment</h4>
          {desiredManifest ? (
            renderYamlWithLineNumbers(yaml.dump(desiredManifest))
          ) : (
            <p style={{ color: '#6E6E6E' }}>⚠️ No matching Deployment found.</p>
          )}
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <h4 style={{ color: '#6E6E6E' }}>Converted Rollout</h4>
          {rolloutManifest ? (
            <>
              {/* COPY BUTTON - Only for Converted Rollout */}
              <button
                onClick={async () => {
                try {
                    await navigator.clipboard.writeText(yaml.dump(rolloutManifest));
                    alert('📋 Rollout YAML copied to clipboard!');
                } catch (err) {
                    alert('❌ Failed to copy!');
                    console.error('Copy failed:', err);
                }
                }}
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    margin: '0.5rem',
                    padding: '0.4rem 0.8rem',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    borderRadius: '6px',
                    backgroundColor: '#00bcd4',
                    color: '#fff',
                    border: 'none',
                    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.3)',
                    cursor: 'pointer',
                    zIndex: 1,
                }}
              >
                Copy
              </button>
            {renderYamlWithLineNumbers(yaml.dump(rolloutManifest))}
            </>
          ) : (
            <p style={{ color: '#6E6E6E' }}>⚠️ Unable to convert to Rollout.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RolloutConvert;