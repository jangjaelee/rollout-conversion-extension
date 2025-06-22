# Kubernetes Deployment to Argo Rollout YAML Converter for Argo CD UI

> This project is an Argo CD UI extension that automatically converts Kubernetes Deployments into Argo Rollouts YAML manifests. It allows users to easily transform their deployment manifests into the Argo Rollouts format directly within the Argo CD web UI.

![image](https://raw.githubusercontent.com/jangjaelee/rollout-conversion-extension/refs/heads/main/ui/images/Rollout-Conversion-Extension.png)

&nbsp;

## Overview

This Argo CD UI extension provides an intuitive way to convert standard Kubernetes `Deployment` resources into `Rollout` resources compatible with [Argo Rollouts](https://argo-rollouts.readthedocs.io/). Designed for teams adopting progressive delivery strategies like canary or blue-green, this tool enables visual transformation of your workloads without leaving the Argo CD interface.

## Key Features

#### 1. Automatic `trafficRouting` Mapping Based on Traffic Management Type

**Purpose**: Automatically configures the `trafficRouting` field of the Rollout resource according to the selected Traffic Manager (e.g., NGINX, ALB, Gateway API) when using the Canary strategy.

**Supported Types**:

| Traffic Manager     | Status     | Description                                                                 |
|---------------------|------------|-----------------------------------------------------------------------------|
| Gateway API         | ✅ Done    | Automatically injects plugin field using selected `HTTPRoute` and `Namespace` |
| NGINX Ingress       | 🛠 Planned | UI for selecting `HTTPRoute` and `Namespace` is under development        |
| ALB (AWS)           | 🛠 Planned  | Annotation-based traffic mapping to be supported                          |

&nbsp;

#### 2. Auto-Register Canary/Blue-Green Services in HTTPRoute Resources

**Purpose**: Automatically adds Canary or Preview backendRefs to the selected HTTPRoute.

**Key Features**:

- Lists and allows selection of Services in the same Namespace
- Appends `backendRef` based on suffix:
  - `-canary` for Canary strategy
  - `-preview` for Blue/Green strategy

&nbsp;

#### 3. YAML Template Generation for Canary / Blue-Green Services

**Purpose**: Generates Service YAML templates for Canary or Preview services based on an existing stable Service.

**Key Features**:

- Copies metadata from the original Service
- Applies suffix (`-canary` / `-preview`) based on selected strategy
- Disables generation if Service already managed by a Rollout (`rollouts-pod-template-hash` selector exists)

&nbsp;

#### 4. Automatic Generation of Analysis Fields and `AnalysisTemplate`

**Purpose**: Enables Canary analysis strategies by auto-generating analysis fields and the corresponding `AnalysisTemplate` YAML.

**Key Features**:

- UI to select Analysis strategy (e.g., success rate)
- Automatically creates and links `AnalysisTemplate` with the Rollout

&nbsp;

#### 5. Rollout YAML Generation for Blue/Green Strategy

**Purpose**: Converts an existing Deployment into a Blue/Green Rollout YAML configuration.

**Key Features**:

- Adds `blueGreen` strategy field with `activeService` and `previewService`
- Supports configuration of `previewMetadata` and `activeMetadata`
- Supports optional:
  - `prePromotionAnalysis` ✅ Done
  - `postPromotionAnalysis` 🛠 In Progress

&nbsp;

#### 6. HPA Resource Conversion for Rollout Target

**Purpose**: Converts existing HPA resources targeting Deployments to target Rollouts instead.

**Key Features**:

- Automatically replaces `scaleTargetRef.kind` from `Deployment` to `Rollout`
- Disables conversion for KEDA-based HPA resources

&nbsp;

#### 7. KEDA ScaledObject Conversion

**Purpose**: Handles ScaledObject conversion only when targeting a Rollout.

**Key Features**:

- Automatically updates `scaleTargetRef.kind` to `Rollout` if currently set to `Deployment`
- Disables conversion if already targeting a `Rollout`

&nbsp;

#### 8. Duplicate Conversion Protection (Deployment → Rollout)

**Purpose**: Prevents transformation if the Deployment has already been converted to a Rollout.

**Key Features**:

- Disables YAML generation when a Rollout references the Deployment using `workloadRef`

---

  
## Install UI extension

The UI extension needs to be installed by mounting the React component in Argo CD API server. This process can be automated by using the [argocd-extension-installer](https://github.com/argoproj-labs/argocd-extension-installer). This installation method will run an init container that will download, extract and place the file in the correct location.

### Kustomize Patch

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: argocd-server
spec:
  template:
    spec:
      initContainers:
        - name: rollout-conversion-extension
          image: quay.io/argoprojlabs/argocd-extension-installer:v0.0.8
          env:
          - name: EXTENSION_URL
            value: https://github.com/jangjaelee/rollout-conversion-extension/raw/refs/heads/main/ui/dist/extension.tar
          volumeMounts:
            - name: extensions
              mountPath: /tmp/extensions/
          securityContext:
            runAsUser: 1000
            allowPrivilegeEscalation: false
      containers:
        - name: argocd-server
          volumeMounts:
            - name: extensions
              mountPath: /tmp/extensions/
      volumes:
        - name: extensions
          emptyDir: {}
```
