// src/utils/renderResourceUI.js

import * as React from 'react';
import yaml from 'js-yaml';
import { copyToClipboard, downloadYaml } from './downloadCopy';
import { PRESETS } from './presets';
import ToggleSwitch from './ToggleSwitch';
import '../index.css';

// YAML + 라인 번호 출력 함수 (flex 기반)
const renderYamlWithLineNumbers = (yamlString) => {
  //const yamlString = props;
  const lines = yamlString.split('\n');

  return (
    <div className="yaml-container">
      {lines.map((line, idx) => (
        <div key={idx} className="yaml-line">
        <span className="yaml-line-number">{idx + 1}</span>
        <span className="yaml-line-content">{line}</span>
        </div>
      ))}
    </div>
  );
};


// YAML copy to clipboard and download buttons 
const YamlActionButtons = ({ yamlObject, filenamePrefix }) => {
  if (!yamlObject) return null;
  return (  
    <div className="button-group">
      <button className="copy-btn" onClick={() => copyToClipboard(yamlObject)}>
        Copy
      </button>
      <button className="download-btn" onClick={() => downloadYaml(yamlObject, filenamePrefix)}>
        Download
      </button>
    </div>
  );
};


export const RenderResourceUI = ({
  resource,
  desiredManifest,
  conversionStrategy,
  conversionMode,
  selectedPreset,
  selectedStableService,
  selectedActiveService,
  selectedHttpRoute,
  selectedHttpRouteService,
  enableAnalysisTemplate,
  isRolloutManaged,
  existingRolloutName,
  serviceManifest,
  rolloutManifest,
  analysisTemplateManifest,
  httprouteManifest,
  duplicateCanaryBackend,
  httpRoutes,
  serviceNames,
  filteredRouteServices,
  isAlreadyRolloutTarget,
  scaledObjectManifest,
  hpaManifest,
  isKedaBasedHPA,
  setConversionStrategy,
  setConversionMode,
  setSelectedPreset,
  setSelectedStableService,
  setSelectedActiveService,
  setSelectedHttpRoute,
  setSelectedHttpRouteService,
  setEnableAnalysisTemplate,
}) => {
  const [showDesiredYaml, setShowDesiredYaml] = React.useState(true);  

  if (resource.kind === 'Service') {
    return (
      <div className="section">
        <h3>Kubernetes Service YAML</h3>
        <div className="button-row">
          <ToggleSwitch
            isChecked={showDesiredYaml}
            onToggle={() => setShowDesiredYaml((prev) => !prev)}
            label={showDesiredYaml ? 'Hide Desired' : 'Show Desired'}
          />
          <p>&nbsp;</p>
         {/*
          <button onClick={() => setShowDesiredYaml((prev) => !prev)}>
            {showDesiredYaml ? 'Hide Desired' : 'Show Desired'}
          </button>
          <button onClick={() => setShowConvertedYaml((prev) => !prev)}>
            {showConvertedYaml ? 'Hide Converted' : 'Show Converted'}
          </button>
          */}
        </div>
          
        <div className="conversion-wrapper">
          <div className={`column ${showDesiredYaml ? 'visible' : 'hidden'}`}>
            <h4 className="subheading">Desired Service</h4>        
            {showDesiredYaml && (desiredManifest ?
              renderYamlWithLineNumbers(yaml.dump(desiredManifest)) : <p className="warn-text">⚠️ No matching Service found.</p>
            )}
          </div>

          <div className="column">
            <h4 className="subheading">Converted Service</h4>
            <div className="controls">
              <label htmlFor="strategy">Deployment Strategy:</label>
              <select id="strategy" value={conversionStrategy} onChange={(e) => setConversionStrategy(e.target.value)}>
                <option value="canary">Canary</option>
                <option value="blueGreen">BlueGreen</option>
              </select>
            </div>

            {isRolloutManaged ? (
              <p className="warn-text">⚠️ This Service is already managed by Argo Rollouts (has rollouts-pod-template-hash selector).</p>
            ) : serviceManifest.length > 0 ? (
              <>
                <YamlActionButtons yamlObject={serviceManifest[0]} filenamePrefix="service" />
                {renderYamlWithLineNumbers(yaml.dump(serviceManifest[0]))}
              </>
            ) : (
              <p className="warn-text">⚠️ Unable to convert to Service.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (resource.kind === 'HTTPRoute') {
    return (
      <div className="section">
        <h3>Kubernetes Gateway API HTTPRoute YAML</h3>
        <div className="conversion-wrapper">
          <div className="column">
            <h4 className="subheading">Desired HTTPRoute</h4>
            {desiredManifest ? renderYamlWithLineNumbers(yaml.dump(desiredManifest)) : <p className="warn-text">⚠️ No matching HTTPRoute found.</p>}
          </div>

          <div className="column">
            <h4 className="subheading">Converted HTTPRoute</h4>

            {duplicateCanaryBackend && (
              <p className="warn-text">⚠️ The backend already exists in HTTPRoute.</p>
            )}

            <div className="controls">
              <label htmlFor="routeStrategy">Deployment Strategy:</label>
              <select id="routeStrategy" value={conversionStrategy} onChange={(e) => setConversionStrategy(e.target.value)}>
                <option value="canary">Canary</option>
                <option value="blueGreen">BlueGreen</option>
              </select>
            </div>

            <div className="controls">
              <label htmlFor="routeService">HTTPRoute Target Service:</label>
              <select id="routeService" value={selectedHttpRouteService} onChange={(e) => setSelectedHttpRouteService(e.target.value)}>                  <option value="">Select Service</option>
                {filteredRouteServices.map((svc) => (
                   <option key={svc} value={svc}>{svc}</option>
                ))}
              </select>
            </div>

            {!selectedHttpRouteService ? (
              <p className="warn-text">
                ⚠️ Please select a service to insert backend into HTTPRoute.
              </p>
            ) : httprouteManifest ? (
              <>
                <YamlActionButtons yamlObject={httprouteManifest} filenamePrefix="httproute" />
                {renderYamlWithLineNumbers(yaml.dump(httprouteManifest))}
              </>
            ) : (
              <p className="warn-text">⚠️ Unable to convert to HTTPRoute.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (resource.kind === 'ScaledObject') {
    return (
      <div className="section">
        <h3>KEDA ScaledObject YAML</h3>
        <div className="conversion-wrapper">
          <div className="column">
            <h4 className="subheading">Desired ScaledObject</h4>
            {desiredManifest ? renderYamlWithLineNumbers(yaml.dump(desiredManifest)) : <p className="warn-text">⚠️ No matching ScaledObject found.</p>}
          </div>
  
          <div className="column">
            <h4 className="subheading">Converted ScaledObject</h4>
            {isAlreadyRolloutTarget ? (
                <p className="warn-text">⚠️ This ScaledObject is already targeting a Rollout.</p>            
            ) : scaledObjectManifest ? (
              <>
                <YamlActionButtons yamlObject={scaledObjectManifest} filenamePrefix="scaledobject" />
                {renderYamlWithLineNumbers(yaml.dump(scaledObjectManifest))}
              </>
            ) : (
              <p className="warn-text">⚠️ Unable to convert to Rollout-targeted ScaledObject.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (resource.kind === 'HorizontalPodAutoscaler') {
    return (
      <div className="section">
        <h3>Horizontal Pod Autoscaler (HPA) YAML</h3>
        <div className="conversion-wrapper">
          <div className="column">
            <h4 className="subheading">Desired HPA</h4>
            {desiredManifest ? renderYamlWithLineNumbers(yaml.dump(desiredManifest)) : <p className="warn-text">⚠️ No matching HPA found.</p>}
          </div>
  
          <div className="column">
            <h4 className="subheading">Converted HPA</h4>
            {isKedaBasedHPA ? (
              <p className="warn-text">⚠️ This HPA is managed by KEDA (conversion disabled).</p>
            ) : hpaManifest ? (
              <>
                <YamlActionButtons yamlObject={hpaManifest} filenamePrefix="hpa" />
                {renderYamlWithLineNumbers(yaml.dump(hpaManifest))}
              </>
            ) : (
              <p className="warn-text">⚠️ Unable to convert HPA to Rollout target.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (resource.kind === 'Deployment') {
    return (
      <div className="section">
        <h3>Kubernetes Deployment to Argo Rollout Conversion</h3>
        <div className="conversion-wrapper">
          <div className="column">
            <h4 className="subheading">Desired Deployment</h4>
            {desiredManifest ? renderYamlWithLineNumbers(yaml.dump(desiredManifest)) : <p className="warn-text">⚠️ No matching Deployment found.</p>}
          </div>

          <div className="column">
            <h4 className="subheading">Converted Rollout</h4>

            {existingRolloutName && (
              <p className="warn-text">
                ⚠️ This Deployment is already referenced by an existing Rollout: <strong>{existingRolloutName}</strong>
              </p>
            )}

            <div className="controls">
              <label htmlFor="strategy">Deployment Strategy:</label>
              <select id="strategy" value={conversionStrategy} onChange={(e) => setConversionStrategy(e.target.value)}>
                <option value="canary">Canary</option>
                <option value="blueGreen">BlueGreen</option>
              </select>
            </div>

            <div className="controls">
              <label htmlFor="mode">Conversion Mode:</label>
              <select id="mode" value={conversionMode} onChange={(e) => setConversionMode(e.target.value)}>
                <option value="template">Classic (with template)</option>
                <option value="workloadRef">WorkloadRef (reference Deployment)</option>
              </select>
            </div>

            {conversionStrategy === 'canary' && (
              <>
                <div className="controls">
                  <label htmlFor="preset">Canary Preset:</label>
                  <select id="preset" value={selectedPreset} onChange={(e) => setSelectedPreset(e.target.value)}>
                    {Object.keys(PRESETS).map((presetName) => (
                      <option key={presetName} value={presetName}>{presetName}</option>
                    ))}
                  </select>
                </div>

                <div className="controls">
                  <label htmlFor="stableService">Stable Service:</label>
                  <select id="stableService" value={selectedStableService} onChange={(e) => setSelectedStableService(e.target.value)}>
                    <option value="">Select Service</option>
                      {serviceNames.map((svc) => (
                        <option key={svc} value={svc}>{svc}</option>
                      ))}
                    </select>
                </div>

                <div className="controls">
                  <label htmlFor="httpRoute">HTTPRoute:</label>
                  <select id="httpRoute" value={selectedHttpRoute} onChange={(e) => setSelectedHttpRoute(e.target.value)}>
                    <option value="">Select HTTPRoute</option>
                    {httpRoutes.map((route) => (
                      <option key={route.metadata.name} value={route.metadata.name}>{route.metadata.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {conversionStrategy === 'blueGreen' && (
              <div className="controls">
                <label htmlFor="activeService">Active Service:</label>
                <select id="activeService" value={selectedActiveService} onChange={(e) => setSelectedActiveService(e.target.value)}>
                  <option value="">Select Service</option>
                  {serviceNames.map((svc) => (
                    <option key={svc} value={svc}>{svc}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="controls">
              <label>
                <input
                  type="checkbox"
                  checked={enableAnalysisTemplate}
                  onChange={(e) => {
                    const isChecked = e.target.checked;

                    if (isChecked) {
                      if ((conversionStrategy === 'canary' && !selectedStableService) || (conversionStrategy === 'blueGreen' && !selectedActiveService)) {
                        alert('⚠️ Please select a required Service before enabling AnalysisTemplate.');
                        return;
                      }
                    }

                    setEnableAnalysisTemplate(isChecked);
                  }}
                />
                 Use AnalysisTemplate
              </label>
            </div>

            {rolloutManifest ? (
              <>
                <YamlActionButtons yamlObject={rolloutManifest} filenamePrefix="rollout" />
                {renderYamlWithLineNumbers(yaml.dump(rolloutManifest))}
              </>
            ) : (
              <p className="warn-text">⚠️ Unable to convert to Rollout.</p>
            )}

            {enableAnalysisTemplate && analysisTemplateManifest && (
              <div className="column">
                <h4 className="subheading">Generated AnalysisTemplate</h4>
                <YamlActionButtons yamlObject={analysisTemplateManifest} filenamePrefix="analysistemplate" />
                {renderYamlWithLineNumbers(yaml.dump(analysisTemplateManifest))}
              </div>
            )}

          </div>
        </div>
      </div>
    );
  }
};