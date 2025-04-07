# # Rollout Conversion Extension for Argo CD UI

이 프로젝트는 Argo CD UI에서 Kubernetes Deployment를 Argo Rollout의 YAML 형식으로 자동으로 변환해주는 확장 도구입니다.

![image](https://raw.githubusercontent.com/jangjaelee/rollout-conversion-extension/refs/heads/main/ui/images/Rollout-Conversion-Extension.png)


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
