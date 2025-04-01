import * as React from 'react';
import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';


((window: any) => {
  const component = () => {
    return React.createElement("div", {}, "Proposed manifest diff(s)");
  };
  
window?.extensionsAPI?.registerResourceExtension(component, '*', 'Application', 'Proposed manifest diff', { icon: "fa fa fa-file-medical" });



const flyoutComponent = (props: {
  openFlyout: () => any
}) => {
return React.createElement(
  "div",
  { 
    style: { padding: "10px" },
    onClick: () => props.openFlyout()
  },
  "Proposed manifest diff(s)"
);
};
const flyout = () => {
return React.createElement(
  "div",
  { style: { padding: "10px" } },
  "This is a flyout"
);
};
window.extensionsAPI.registerStatusPanelExtension(
  flyoutComponent,
"My Extension",
"my_extension",
flyout
);


})(window);