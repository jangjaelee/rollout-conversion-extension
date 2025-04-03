import * as React from 'react';
import { useMemo, useState, useEffect } from 'react';
import yaml from 'js-yaml';
//import './index.css';

const DeploymentDesiredManifestTab = ({ resource }) => {
  const [matchedManifests, setMatchedManifests] = useState([]);

  useEffect(() => {
    const labels = resource.metadata?.labels || {};
    const appName =
      labels["argocd.argoproj.io/instance"] ||
      labels["app.kubernetes.io/instance"];

    if (!appName) {
      console.warn("Application name not found in labels");
      return;
    }

    const fetchDesiredManifest = async () => {
      try {
        const response = await fetch(
          `/api/v1/applications/${appName}/manifests`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) throw new Error("Failed to fetch manifests");

        const data = await response.json();
        const rawManifests = data?.manifests ?? [];

        const manifests = rawManifests.map((m) =>
          typeof m === "string" ? JSON.parse(m) : m
        );

        setMatchedManifests(manifests);
      } catch (err) {
        console.error("Error fetching desired manifest:", err);
        setMatchedManifests([]);
      }
    };

    fetchDesiredManifest();
  }, [resource]);

  return (
    <div>
      <h3>Desired Deployment Manifest</h3>
      {matchedManifests.length > 0 ? (
          <pre
            key={idx}
            style={{
              background: "#f4f4f4",
              padding: "1rem",
              borderRadius: "8px",
              overflowX: "auto",
              fontSize: "12px",
              marginBottom: "1rem",
            }}
          >
            {yaml.dump(manifest)}
          </pre>
      ) : (
        <p>Matching manifest not found.</p>
      )}
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