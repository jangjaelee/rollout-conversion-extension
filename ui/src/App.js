import * as React from 'react';
import { useEffect, useState } from 'react';
import yaml from 'js-yaml';
import './index.css';
import { PRESETS } from './utils/presets';
import { convertDeploymentToRollout } from './utils/convertDeployment';
import { duplicateServiceForCanary } from './utils/serviceDuplicate';
import { addCanaryBackendToHTTPRoute } from './utils/addCanaryToHttpRoute';


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
  const [httprouteManifest, setHttprouteManifest] = useState(null);
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
  }, [resource, selectedPreset, conversionMode]);

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
            {serviceManifest.length > 0 ? (
            <>
              <div className="button-group">
                <button
                  className="copy-btn"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(yaml.dump(serviceManifest[0]));
                      alert('📋 Canary Service YAML copied to clipboard!');
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
                    const yamlString = yaml.dump(serviceManifest[0]);
                    const blob = new Blob([yamlString], { type: 'text/yaml' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `service-${serviceManifest[0].metadata.name || 'service'}.yaml`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download
                </button>
              </div>

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