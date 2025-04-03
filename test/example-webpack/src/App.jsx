import React from "react";
import yaml from "js-yaml";

const DebugMatchTable = ({ manifests, resource }) => {
  return (
    <div style={{ marginTop: "2rem" }}>
      <h4>Matching Debug Table</h4>
      <table border="1" cellPadding="8" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Index</th>
            <th>apiVersion</th>
            <th>kind</th>
            <th>name</th>
            <th>Matches?</th>
          </tr>
        </thead>
        <tbody>
          {manifests.map((m, idx) => {
            const matches =
              m.apiVersion === resource.apiVersion &&
              m.kind === resource.kind &&
              m.metadata?.name === resource.metadata?.name;

            return (
              <tr key={idx}>
                <td>{idx}</td>
                <td>{m.apiVersion}</td>
                <td>{m.kind}</td>
                <td>{m.metadata?.name}</td>
                <td style={{ color: matches ? "green" : "red" }}>
                  {matches ? "✅ Yes" : "❌ No"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const DeploymentDesiredManifestTab = ({ resource, token }) => {
  const [matchedManifest, setMatchedManifest] = React.useState(null);
  const [allManifests, setAllManifests] = React.useState([]);
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
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
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
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

        setAllManifests(manifests);

        const matched = manifests.find((m) => {
          return (
            m.apiVersion === resource.apiVersion &&
            m.kind === resource.kind &&
            m.metadata?.name === resource.metadata?.name
          );
        });

        setMatchedManifest(matched || null);
      } catch (err) {
        console.error("Error fetching desired manifest:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDesiredManifest();
  }, [resource, token]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>❌ {error}</p>;

  return (
    <div style={{ fontFamily: "monospace", fontSize: "14px" }}>
      <h3>🎯 Matching Deployment Manifest</h3>

      {matchedManifest ? (
        <pre
          style={{
            background: "#f0f0f0",
            padding: "1rem",
            borderRadius: "8px",
            overflowX: "auto",
          }}
        >
          {/*JSON.stringify(matchedManifest, null, 2)*/}
          {yaml.dump(matchedManifest)}
        </pre>
      ) : (
        <p>⚠️ No matching manifest found.</p>
      )}

      {/*<DebugMatchTable manifests={allManifests} resource={resource} />*/}
    </div>
  );
};

export default DeploymentDesiredManifestTab;