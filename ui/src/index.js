import * as React from 'react';
import { useEffect, useState } from 'react';
import yaml from 'js-yaml';

const convertDeploymentToRollout = (deployment) => {
  if (!deployment) return null;

  const rollout = {
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

  return rollout;
};

const DeploymentDesiredManifestTab = ({ resource }) => {
  const [matchedManifest, setMatchedManifest] = useState(null);
  const [rolloutManifest, setRolloutManifest] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const labels = resource.metadata?.labels || {};
    const appName =
      labels["argocd.argoproj.io/instance"] ||
      labels["app.kubernetes.io/instance"];

    if (!appName) {
      setError("Application name not found in labels");
      setLoading(false);
      return;
    }

    const fetchDesiredManifest = async () => {
      try {
        const response = await fetch(
          `/api/v1/applications/${appName}/manifests`,
          { credentials: "include" }
        );

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json();
        const rawManifests = data?.manifests ?? [];

        const manifests = rawManifests.map((m) =>
          typeof m === "string" ? JSON.parse(m) : m
        );

        const matched = manifests.find(
          (m) =>
            m.apiVersion === resource.apiVersion &&
            m.kind === resource.kind &&
            m.metadata?.name === resource.metadata?.name
        );

        setMatchedManifest(matched || null);
        if (matched) {
          const rollout = convertDeploymentToRollout(matched);
          setRolloutManifest(rollout);
        }
      } catch (err) {
        console.error("Error fetching desired manifest:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDesiredManifest();
  }, [resource]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>❌ {error}</p>;

  return (
    <div style={{ width: '100%' }}>
      <h3>🎯 Deployment → Argo Rollout 변환 비교</h3>
      <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
        <div style={{ flex: 1 }}>
          <h4>📦 Deployment</h4>
          {matchedManifest ? (
            <pre style={{
              background: "#f0f0f0",
              padding: "1rem",
              borderRadius: "8px",
              overflowX: "auto",
              fontFamily: "monospace",
              fontSize: "14px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {yaml.dump(matchedManifest)}
            </pre>
          ) : (
            <p>⚠️ No matching Deployment found.</p>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <h4>🚀 Converted Rollout</h4>
          {rolloutManifest ? (
            <pre style={{
              background: "#f8f8f8",
              padding: "1rem",
              borderRadius: "8px",
              overflowX: "auto",
              fontFamily: "monospace",
              fontSize: "14px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {yaml.dump(rolloutManifest)}
            </pre>
          ) : (
            <p>⚠️ Unable to convert to Rollout.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeploymentDesiredManifestTab;

((window) => {
  window?.extensionsAPI?.registerResourceExtension(
    DeploymentDesiredManifestTab,
    "apps",
    "Deployment",
    "Annotations YAML"
  );
})(window);