import mermaid from 'mermaid';
// stub minimal DOM
globalThis.document = { querySelector: () => null, createElement: () => ({ style: {}, setAttribute(){}, appendChild(){}, getBBox: () => ({width:100,height:20})}), createElementNS: () => ({ style: {}, setAttribute(){}, appendChild(){}, getBBox: () => ({width:100,height:20})}), body: { appendChild(){}, removeChild(){} } };
