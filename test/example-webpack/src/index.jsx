import React from "react";
import ReactDOM from "react-dom/client";
import DeploymentDesiredManifestTab from "./App.jsx";

const sampleResource = {
  apiVersion: "apps/v1",
  kind: "Deployment",
  metadata: {
    name: "helloworld-v1",
    namespace: "default",
    labels: {
      "argocd.argoproj.io/instance": "gitops-nginx",
    },
  },
};

const token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhcmdvY2QiLCJzdWIiOiJhZG1pbjphcGlLZXkiLCJuYmYiOjE3NDM2NTM1MTUsImlhdCI6MTc0MzY1MzUxNSwianRpIjoiNjJlMzBlMzEtODZiYy00MTUzLWJjMTEtMTYxMDRlNTRmYWVhIn0.V_yx8oz-3gOlTsB9gs10F3CDTuQs6OyFPI97dv3AFKc";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <DeploymentDesiredManifestTab resource={sampleResource} token={token} />
);