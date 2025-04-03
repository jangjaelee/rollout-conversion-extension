import * as React from 'react';
import { useMemo, useState, useEffect } from 'react';
import yaml from 'js-yaml';
//import './index.css';

/*
((window) => {
  const { createElement } = React;

  const PRESETS = {
    'Quick (20%, 50%)': [
      { setWeight: 20 },
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

  const convertDeploymentToRollout = (deployment, steps) => {
    if (!deployment || deployment.kind !== 'Deployment') return null;

    const {
      metadata,
      spec: {
        replicas,
        selector,
        template,
        revisionHistoryLimit,
        progressDeadlineSeconds,
        minReadySeconds,
      },
    } = deployment;

    return {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Rollout',
      metadata,
      spec: {
        replicas,
        selector,
        template,
        strategy: {
          canary: { steps },
        },
        revisionHistoryLimit,
        progressDeadlineSeconds,
        minReadySeconds,
      },
    };
  };

  const CopyButton = ({ text }) =>
    createElement(
      'button',
      {
        className: 'copy-btn',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(text);
            alert('YAML copied to clipboard!');
          } catch (err) {
            alert('Failed to copy YAML.');
          }
        },
      },
      'Copy YAML'
    );

  const DeploymentYamlViewer = ({ resource }) => {
    const [presetName, setPresetName] = useState('Quick (20%, 50%)');

    const liveYaml = useMemo(() => {
      if (!resource) return '# No live resource available';
      try {
        return yaml.dump(resource);
      } catch {
        return '# Error converting live resource to YAML';
      }
    }, [resource]);

    const rolloutYaml = useMemo(() => {
      try {
        const rollout = convertDeploymentToRollout(resource, PRESETS[presetName]);
        return rollout ? yaml.dump(rollout) : '# Could not convert Deployment to Rollout';
      } catch {
        return '# Error converting Deployment to Rollout';
      }
    }, [resource, presetName]);

    return createElement('div', { className: 'diff-container' }, [
      // Left: Deployment
      createElement('div', { className: 'diff-column' }, [
        createElement('h3', {}, 'Live Deployment YAML'),
        createElement(CopyButton, { text: liveYaml }),
        createElement('pre', { className: 'yaml-box' }, liveYaml),
      ]),

      // Right: Rollout
      createElement('div', { className: 'diff-column' }, [
        createElement('h3', {}, 'Converted Rollout YAML'),
        createElement(
          'div',
          { className: 'preset-select' },
          createElement(
            'select',
            {
              value: presetName,
              onChange: (e) => setPresetName(e.target.value),
            },
            Object.keys(PRESETS).map((key) =>
              createElement('option', { key, value: key }, key)
            )
          )
        ),
        createElement(CopyButton, { text: rolloutYaml }),
        createElement('pre', { className: 'yaml-box' }, rolloutYaml),
      ]),
    ]);
  };

  window.extensionsAPI?.registerResourceExtension?.(
    DeploymentYamlViewer,
    'apps',
    'Deployment',
    'YAML Viewer'
  );
})(window);
*/


 /* const DeploymentAnnotationsYamlTab = ({ resource }: { resource: any }) => {
    const labels = resource?.metadata?.labels || {};
    const exlabels = labels["app.kubernetes.io/instance"] || labels["argocd.argoproj.io/instance"];

    if (!exlabels) {
      console.warn("Application name not found in labels");
      return;
    }

    const yamlString = toString(exlabels);
  
    return (
      <div style={{
        margin: '1rem',
        padding: '1rem',
        border: '1px solid #ccc',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9'
      }}>
        <pre style={{
          whiteSpace: 'pre-wrap',
          fontSize: '14px',
          lineHeight: '1.5',
          color: '#333'
        }}>
          {yamlString}
        </pre>
      </div>
    );
  };*/


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
  
          setMatchedManifest(rawManifests || null);
        } catch (err) {
          console.error("Error fetching desired manifest:", err);
          setMatchedManifest(null);
        }
      };
  
      fetchDesiredManifest();
    }, [resource]);
  
    return (
      <div>
        <h3>Desired Deployment Manifest</h3>
        {matchedManifest ? (
          <pre
            style={{
              background: "#f4f4f4",
              padding: "1rem",
              borderRadius: "8px",
              overflowX: "auto",
              fontSize: "12px",
            }}
          >
            {matchedManifest}
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