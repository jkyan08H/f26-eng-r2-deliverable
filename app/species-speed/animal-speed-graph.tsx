// /* eslint-disable */
// "use client";
// import { useRef, useEffect, useState  } from "react";
// import { select } from "d3-selection";
// import { scaleBand, scaleLinear, scaleOrdinal } from "d3-scale";
// import { max } from "d3-array";
// import { axisBottom, axisLeft } from "d3-axis"; // D3 is a JavaScript library for data visualization: https://d3js.org/
// import { csv } from "d3-fetch";

// // Example data: Only the first three rows are provided as an example
// // Add more animals or change up the style as you desire

// // TODO: Write this interface
// interface AnimalDatum  {

// }


// export default function AnimalSpeedGraph() {
//   // useRef creates a reference to the div where D3 will draw the chart.
//   // https://react.dev/reference/react/useRef
//   const graphRef = useRef<HTMLDivElement>(null);

//   const [animalData, setAnimalData] = useState<AnimalDatum[]>([]);

//   // TODO: Load CSV data
//   useEffect(() => {
//     console.log("Implement CSV loading!")
//   }, []);

//   useEffect(() => {
//     // Clear any previous SVG to avoid duplicates when React hot-reloads
//     if (graphRef.current) {
//       graphRef.current.innerHTML = "";
//     }

//     if (animalData.length === 0) return;

//     // Set up chart dimensions and margins
//     const containerWidth = graphRef.current?.clientWidth ?? 800;
//     const containerHeight = graphRef.current?.clientHeight ?? 500;

//     // Set up chart dimensions and margins
//     const width = Math.max(containerWidth, 600); // Minimum width of 600px
//     const height = Math.max(containerHeight, 400); // Minimum height of 400px
//     const margin = { top: 70, right: 60, bottom: 80, left: 100 };

//     // Create the SVG element where D3 will draw the chart
//     // https://github.com/d3/d3-selection
//     const svg  = select(graphRef.current!)
//       .append<SVGSVGElement>("svg")
//       .attr("width", width)
//       .attr("height", height)

//     // TODO: Implement the rest of the graph
//     // HINT: Look up the documentation at these links
//     // https://github.com/d3/d3-scale#band-scales
//     // https://github.com/d3/d3-scale#linear-scales
//     // https://github.com/d3/d3-scale#ordinal-scales
//     // https://github.com/d3/d3-axis
//   }, [animalData]);

//   // TODO: Return the graph
//   return (
//     // Placeholder so that this compiles. Delete this below:
//     <div>
//       <h1> TODO: Delete this div in `animal-speed-graph.tsx` and implement the graph: </h1>
//     </div>
//   );
// }
