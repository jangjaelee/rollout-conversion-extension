# Overview

Rollout Conversion Extension은 Kubernetes Deployment를 Argo Rollout YAML 매니페스트로 자동 변환하는 Argo CD UI 확장 프로그램입니다. 사용자가 Argo CD Web UI 내에서 직접 배포 매니페스트를 Argo Rollouts 형식으로 쉽게 변환할 수 있도록 해줍니다.

이 확장 프로그램은 Canary나 Blue-Green과 같은 점진적 배포 전략을 채택하는 팀을 위해 설계되었으며, Argo CD 인터페이스를 벗어나지 않고도 워크로드를 시각적으로 변환할 수 있는 도구를 제공합니다.

&nbsp;

# Project Structure

```
rollout-conversion-extension/
├── images/                              # 이미지 리소스 파일
├── src/                                 # 주요 소스 디렉토리
│   ├── utils/                           # 유틸리티 함수 및 React 컴포넌트 모음
│   │   ├── ToggleSwitch.css             # 토글 스위치 스타일
│   │   ├── ToggleSwitch.js              # 토글 스위치 컴포넌트
│   │   ├── addBackendToHttpRoute.js     # HTTPRoute backend 구성 삽입
│   │   ├── convertAutoscalers.js        # HPA, KEDA 변환 처리
│   │   ├── convertDeployment.js         # Deployment → Rollout 변환 로직
│   │   ├── createAnalysisTemplate.js    # AnalysisTemplate 자동 생성
│   │   ├── downloadCopy.js              # YAML 다운로드 및 복사 처리
│   │   ├── presets.js                   # Canary Preset 전략 구성 방식
│   │   ├── renderResourceUI.js          # UI 구성 요소 생성 로직
│   │   └── serviceDuplicate.js          # Service 중복 체크
│   ├── App.js                           # 메인 리액트 앱 컴포넌트
│   ├── index.css                        # 전역 스타일 정의
│   └── index.js                         # 앱 진입점
├── .env                                 # 환경 변수 설정 파일
├── DEVELOPER.md                         # 개발자 가이드
├── README.md                            # 사용자 및 설치 가이드
├── package.json                         # 의존성 및 스크립트 정의
└── webpack.config.js                    # Webpack 빌드 도구 설정
```

## Core Components

- App.js: 메인 React 애플리케이션 컴포넌트
- convertDeployment.js: Deployment를 Rollout으로 변환하는 핵심 로직
- presets.js: Canary 및 Blue-Green 배포 전략 프리셋 관리
- renderResourceUI.js: 사용자 인터페이스 렌더링 로직

&nbsp;

# **Development Setup**

## **Requirements**

- Node.js ≥ 18.x
- npm ≥ 9.x
- React ^9.
- Webpack ^5.x

&nbsp;

# **Build & Deploy**

## **Build for Production**

> npm run bu는 webpack 빌드 후 dist/extension.tar을 생성하는 스크립트입니다.
내부적으로 NODE_OPTIONS=--openssl-legacy-provider webpack --config ./webpack.config.js && tar -C dist -cvf dist/extension.tar resources 명령을 실행합니다.
> 

```bash
$ npm run bu
```

## **Package as Argo CD Extension (option)**

```bash
# Webpack 빌드 후 `dist/` 생성됨
$ tar -cvf extension.tar dist/
```

## **Argo CD에 설치 (initContainer 예시)**

argocd-extension-installer를 사용하여 자동화된 설치 프로세스를 통해 UI 확장을 설치해야 합니다. 이 설치 방법은 파일을 다운로드, 추출하여 올바른 위치에 배치하는 init 컨테이너를 실행합니다.

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
            value: https://raw.githubusercontent.com/jangjaelee/rollout-conversion-extension/main/ui/dist/extension.tar
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

## **Authenticated Download (Private Repo)**

GitHub Private Repository로부터 `extension.tar` 파일을 다운로드할 때는 Personal Access Token(EXTENSION_GIT_TOKEN)을 환경 변수로 주입하여 인증을 수행해야 합니다. 아래는 Kubernetes Secret을 통해 token을 주입하는 예시입니다.

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
          image: cine0831/argocd-extension-installer:v0.0.9
          env:
          - name: EXTENSION_URL
            value: https://raw.githubusercontent.com/jangjaelee/rollout-conversion-extension/main/ui/dist/extension.tar
          - name: EXTENSION_GIT_TOKEN
            valueFrom:
              secretKeyRef:
                name: github-token-secret
                key: EXTENSION_GIT_TOKEN             
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
---
apiVersion: v1
kind: Secret
metadata:
  name: github-token-secret
  namespace: argocd
type: Opaque
stringData:
  EXTENSION_GIT_TOKEN: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

&nbsp;

# Resources

- [Argo CD Extensions Documentation](https://argo-cd.readthedocs.io/en/stable/developer-guide/extensions/)
- [Argo Rollouts Documentation](https://argoproj.github.io/argo-rollouts/)
- [React Documentation](https://react.dev/)
- [Webpack Documentation](https://webpack.js.org/)
