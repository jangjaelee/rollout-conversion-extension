import * as React from 'react';
import { useMemo, useState, useEffect } from 'react';
import yaml from 'js-yaml';
//import './index.css';

  const DeploymentDesiredManifestTab = ({ resource }) => {
    const [matchedManifest, setMatchedManifest] = React.useState(null);
  
    React.useEffect(() => {
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
  
          // Parse if manifests are strings
          const manifests = rawManifests.map((m) =>
            typeof m === "string" ? JSON.parse(m) : m
          );
  
          /*const matched = manifests.find((m) => {
            return (
              m.kind === "Deployment" &&
              m.apiVersion === resource.apiVersion &&
              m.metadata?.name === resource.metadata?.name &&
              m.metadata?.namespace === resource.metadata?.namespace
            );
          });*/
  
          setMatchedManifest(manifests);
        } catch (err) {
          console.error("Error fetching desired manifest:", err);
          setMatchedManifest([]);
        }
      };
  
      fetchDesiredManifest();
    }, [resource]);
  
    return (
      <div>
        <h3>Desired Deployment Manifest</h3>
        {matchedManifest.length > 0 ? (
          matchedManifest.map((manifest, idx) => (
          <pre
            style={{
              background: "#f4f4f4",
              padding: "1rem",
              borderRadius: "8px",
              overflowX: "auto",
              fontSize: "12px",
            }}
          >
            {yaml.dump(manifest)}
          </pre>
          ))
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