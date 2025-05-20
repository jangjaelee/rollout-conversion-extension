import * as React from 'react';
import { useEffect, useState } from 'react';
import { PRESETS } from './utils/presets';
import { convertDeploymentToRollout } from './utils/convertDeployment';
import { duplicateServiceWithSuffix, useIsRolloutManagedService } from './utils/serviceDuplicate';
import { addBackendToHTTPRoute } from './utils/addBackendToHttpRoute';
import { createAnalysisTemplate } from './utils/createAnalysisTemplate';
import { convertScaledObject, convertHPA } from './utils/convertAutoscalers';
import { RenderResourceUI } from './utils/renderResourceUI';


const RolloutConvert = ( {application, resource} ) => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [desiredManifest, setDesiredManifest] = useState(null);
  const [rolloutManifest, setRolloutManifest] = useState(null);
  const [serviceManifest, setServiceManifest] = useState([]);
  const [httprouteManifest, setHttprouteManifest] = useState(null);
  const [analysisTemplateManifest, setAnalysisTemplateManifest] = useState(null);
  const [scaledObjectManifest, setScaledObjectManifest] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState('Quick (10%, 30%, 100%)');
  const [conversionMode, setConversionMode] = useState('workloadRef');
  const [conversionStrategy, setConversionStrategy] = useState('canary');
  const [enableAnalysisTemplate, setEnableAnalysisTemplate] = useState(false);
  const isRolloutManaged = useIsRolloutManagedService(resource);
  const [httpRoutes, setHttpRoutes] = useState([]);
  const [selectedHttpRoute, setSelectedHttpRoute] = useState('');
  const [duplicateCanaryBackend, setDuplicateCanaryBackend] = useState(false);
  const [isAlreadyRolloutTarget, setIsAlreadyRolloutTarget] = useState(false);
  const [hpaManifest, setHpaManifest] = useState(null);
  const [isKedaBasedHPA, setIsKedaBasedHPA] = useState(false);  
  const [serviceNames, setServiceNames] = useState([]);
  const [selectedStableService, setSelectedStableService] = useState(''); // for Canary
  const [selectedActiveService, setSelectedActiveService] = useState(''); // for Blue/Green
  const [selectedHttpRouteService, setSelectedHttpRouteService] = useState('');  
  const [existingRolloutName, setExistingRolloutName] = useState('');
  const [filteredRouteServices, setFilteredRouteServices] = useState([]);


  // conversionStrategy가 canary ↔ blueGreen으로 변경될 때, 이전에 선택한 selectedHttpRouteService를 초기화하여 올바르지 않은 backendRefs 삽입을 방지
  useEffect(() => {
    setSelectedHttpRouteService('');
  }, [conversionStrategy]);


  useEffect(() => {
    // HTTPRoute 내에서 selectedhttpRouteService 목록을 '-canary', '-preview' suffix 로만 필터링 하기 위함
    const filtered = serviceNames.filter((svcName) =>
      conversionStrategy === 'canary'
        ? svcName.endsWith('-canary')
        : svcName.endsWith('-preview')
    );
    setFilteredRouteServices(filtered);

    if (resource.kind !== 'HTTPRoute') return;
    if (!desiredManifest) return;
  
    if (!selectedHttpRouteService) {
      setHttprouteManifest(null);
      setDuplicateCanaryBackend(false);
      return;
    }
  
    const { updatedRoute, duplicate } = addBackendToHTTPRoute(desiredManifest, selectedHttpRouteService);
    setHttprouteManifest(updatedRoute);
    setDuplicateCanaryBackend(duplicate);
  }, [resource.kind, desiredManifest, selectedHttpRouteService, conversionStrategy, serviceNames]);  


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

        // 이미 Rollout으로 변환이 완료된 Deployment는 팝업 메세지 출력
        if (resource.kind === 'Deployment') {
          const existingRolloutUsingWorkloadRef = manifests.find(
            (m) =>
              m.kind === 'Rollout' &&
              m.spec?.workloadRef?.name === resource.metadata.name &&
              m.spec?.workloadRef?.kind === 'Deployment'
          );

          if (existingRolloutUsingWorkloadRef) {
            const rolloutName = existingRolloutUsingWorkloadRef.metadata?.name || 'unknown';
            //alert(`⚠️ This Deployment is already referenced by an existing Rollout: "${rolloutName}"`);
            setExistingRolloutName(rolloutName);
          }
        }

        // 우선순위: resource → matched → application (fallback)
        const targetNamespace =
          resource?.metadata?.namespace ||
          matched?.metadata?.namespace ||
          application?.spec?.destination?.namespace ||
          null;

        // targetNamespace가 있을 경우에만 필터링        
        const routes = manifests.filter((m) => m.kind === 'HTTPRoute')
          .map((m) => {
            if (!m.metadata?.namespace && targetNamespace) {
              // 메모리 상에서만 임시로 namespace 주입
              return {
                ...m,
                metadata: {
                  ...m.metadata,
                  namespace: targetNamespace,
                },
              };
            }

            return m;
        })
          .filter((m) => targetNamespace ? m.metadata.namespace === targetNamespace : true
        );
        setHttpRoutes(routes);

        const serviceNamesList = manifests
          .filter((m) =>
            m.kind === 'Service' &&
            m.metadata?.name &&
            (
              resource.kind === 'HTTPRoute' // HTTPRoute일 때는 모든 서비스 포함
                ? true
                : (!m.metadata.name.endsWith('-canary') && !m.metadata.name.endsWith('-preview'))
            )
          )
          .map((s) => s.metadata.name);
        setServiceNames(serviceNamesList);

        if (matched) {
          // Deployment일 경우에만 Rollout 변환 수행
          if (resource.kind === 'Deployment') {          
            const selectedSteps = conversionStrategy === 'canary' ? PRESETS[selectedPreset] : undefined;

            if (conversionStrategy === 'canary' && !selectedSteps) {
              setError(`Invalid Canary Preset: "${selectedPreset}" is not defined`);
              setLoading(false);
              return;
            }

            const templateName = `${matched.metadata.name}-analysis-template`;
            const serviceFQDN =
              conversionStrategy === 'canary'
                ? selectedStableService
                  ? `${selectedStableService}.${targetNamespace}.svc.cluster.local`
                  : undefined
                : selectedActiveService
                  ? `${selectedActiveService}.${targetNamespace}.svc.cluster.local`
                  : undefined;

            const rollout = convertDeploymentToRollout({
              deployment: matched,
              steps: selectedSteps,
              mode: conversionMode,
              strategy: conversionStrategy,
              httpRoute: selectedHttpRoute,
              namespace: targetNamespace,
              stableServiceName: selectedStableService,
              analysisEnabled: enableAnalysisTemplate,
              templateName: templateName,
              serviceFQDN: serviceFQDN,
              activeServiceName: selectedActiveService,
            });          

            // enableAnalysisTemplate가 true인 경우 rollout에 analysis 추가
            if (enableAnalysisTemplate && (selectedStableService || selectedActiveService)) {
              const analysisTemplate = createAnalysisTemplate({
                name: matched.metadata.name,
                namespace: matched.metadata.namespace,
              });
              setAnalysisTemplateManifest(analysisTemplate);
            } else {
              setAnalysisTemplateManifest(null);
            }
            
            setRolloutManifest(rollout);
          }

          // Service일 경우에만 배포 전략에 따라 Service 변환 수행
          if (resource.kind === 'Service') {
            // rollouts-pod-template-hash는 Argo Rollouts가 관리하는 Deployment가 생성한 ReplicaSet이 가진 라벨이며, Service가 selector로 가지고 있으며 ResourceTab에 표시하지 않음
            const hasRolloutSelector = matched?.spec?.selector && Object.prototype.hasOwnProperty.call(matched.spec.selector, 'rollouts-pod-template-hash');
        
            if (hasRolloutSelector) {
              setError('This Service is already managed by Argo Rollouts (has rollouts-pod-template-hash selector).');
              setLoading(false);
              return;
            }

            // 배포 전략에 따라 suffix 결정
            const suffix = conversionStrategy === 'canary' ? '-canary' : '-preview';
            const { duplicated } = duplicateServiceWithSuffix(matched, suffix);

            setServiceManifest(duplicated ? [duplicated] : []);
          }

          // HTTPRoute일 경우에만 canary를 위한 rules[].backendRefs 추가 수행
          if (resource.kind === 'HTTPRoute') {
            // 서비스 이름이 비어 있으면 변환 생략
            if (!selectedHttpRouteService) {
              setHttprouteManifest(null);
              setDuplicateCanaryBackend(false);
              return;
            }

            const { updatedRoute, duplicate } = addBackendToHTTPRoute(matched, selectedHttpRouteService);
            setHttprouteManifest(updatedRoute);
            setDuplicateCanaryBackend(duplicate);
          }

          // ScaledObject일 경우에만 sacleTargetRef의 kind를 변경
          if (resource.kind === 'ScaledObject') {
            const { converted, isAlreadyRolloutTarget } = convertScaledObject(matched);
            
            setIsAlreadyRolloutTarget(isAlreadyRolloutTarget);
            
            if (!isAlreadyRolloutTarget && converted) {
              setScaledObjectManifest(converted);
            }
          }

          // HorizontalPodAutoscaler일 경우에만 sacleTargetRef의 kind를 변경
          if (resource.kind === 'HorizontalPodAutoscaler') {
            const { converted, isKedaBased } = convertHPA(matched);

            setIsKedaBasedHPA(isKedaBased);

            if (!isKedaBased && converted) {
              setHpaManifest(converted);
            }
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
  }, [
    resource,
    selectedPreset,
    conversionMode,
    conversionStrategy,
    enableAnalysisTemplate,
    selectedHttpRoute,
    duplicateCanaryBackend,
    selectedStableService,
    selectedActiveService,
    selectedHttpRouteService,
  ]);

  
  if (loading) return <p>Loading...</p>;
  if (error) return <p className="error-text">❌ {error}</p>;

  
  return (
    <RenderResourceUI
      resource={resource}
      desiredManifest={desiredManifest}
      conversionStrategy={conversionStrategy}
      conversionMode={conversionMode}
      selectedPreset={selectedPreset}
      selectedStableService={selectedStableService}
      selectedActiveService={selectedActiveService}
      selectedHttpRoute={selectedHttpRoute}
      selectedHttpRouteService={selectedHttpRouteService}
      enableAnalysisTemplate={enableAnalysisTemplate}
      isRolloutManaged={isRolloutManaged}
      existingRolloutName={existingRolloutName}
      serviceManifest={serviceManifest}
      rolloutManifest={rolloutManifest}
      analysisTemplateManifest={analysisTemplateManifest}
      httprouteManifest={httprouteManifest}
      duplicateCanaryBackend={duplicateCanaryBackend}
      httpRoutes={httpRoutes}
      serviceNames={serviceNames}
      filteredRouteServices={filteredRouteServices}
      isAlreadyRolloutTarget={isAlreadyRolloutTarget}
      scaledObjectManifest={scaledObjectManifest}
      hpaManifest={hpaManifest}
      isKedaBasedHPA={isKedaBasedHPA}
      setConversionStrategy={setConversionStrategy}
      setConversionMode={setConversionMode}
      setSelectedPreset={setSelectedPreset}
      setSelectedStableService={setSelectedStableService}
      setSelectedActiveService={setSelectedActiveService}
      setSelectedHttpRoute={setSelectedHttpRoute}
      setSelectedHttpRouteService={setSelectedHttpRouteService}
      setEnableAnalysisTemplate={setEnableAnalysisTemplate}
    />
  );
};

export default RolloutConvert;
