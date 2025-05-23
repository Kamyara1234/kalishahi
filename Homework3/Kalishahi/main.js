const svg = d3.select("svg");

const svgWidth = document.documentElement.clientWidth;
const svgHeight = document.documentElement.clientHeight;

// --- Configuration for Layout ---
const margin = { top: 60, right: 30, bottom: 80, left: 100 };
const marginPCP = { top: 60, right: 10, bottom: 50, left: 10 }; 

const leftWidthRatio = 0.42;
const rightWidthRatio = 0.48;
const chartSpacingHorizontal = svgWidth * 0.08;
const chartSpacingVertical = svgHeight * 0.05;

// --- Chart Dimensions ---
const pieChartWidth = svgWidth * leftWidthRatio - margin.left - margin.right;
const pieChartHeight = svgHeight * 0.45 - margin.top - margin.bottom;
const pieChartRadius = Math.min(pieChartWidth, pieChartHeight) / 2;

const pcpWidth = svgWidth * leftWidthRatio - margin.left - margin.right;
const pcpHeight = svgHeight * 0.40 - margin.top - marginPCP.bottom;

const barChartStartX = margin.left + pieChartWidth + margin.right + chartSpacingHorizontal;
const barChartWidth = svgWidth - barChartStartX - margin.right;
const barChartHeight = svgHeight - margin.top - margin.bottom;

// --- Create Group elements for charts ---
const pieG = svg.append("g")
    .attr("transform", `translate(${margin.left + pieChartWidth / 2}, ${margin.top + pieChartHeight / 2})`);

const pcpG = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top + pieChartHeight + margin.bottom + chartSpacingVertical + 20})`); // Adjusted y for PCP title

const barG = svg.append("g")
    .attr("transform", `translate(${barChartStartX}, ${margin.top})`);

// --- Global variables for interactions and data ---
let originalData = [];
let activePCPBrushesExtents = {}; 
let selectedExperienceLevelForPCP = null;


let xBar, yBar, xAxisBar, yAxisBar;
let xPCP, yPCP = {};
let expColor; 
const expLevelOrder = ['EN', 'MI', 'SE', 'EX'];
const expLevelNames = { 'EN': 'Entry', 'MI': 'Mid', 'SE': 'Senior', 'EX': 'Executive' };
const sizeNames = { 'S': 'Small', 'M': 'Medium', 'L': 'Large' };
const dimensions = ["work_year", "salary_in_usd", "remote_ratio"];
const dimensionNames = {
    "work_year": "Year",
    "salary_in_usd": "Salary (USD)",
    "remote_ratio": "Remote Ratio (%)"
};


d3.csv("ds_salaries.csv").then(function(data) {
    originalData = data; 

    // --- Data Preprocessing ---
    originalData.forEach(d => {
        d.salary_in_usd = +d.salary_in_usd;
        d.work_year = +d.work_year;
        d.remote_ratio = +d.remote_ratio;
    });

    // --- Color Scales ---
    expColor = d3.scaleOrdinal()
        .domain(expLevelOrder)
        .range(d3.schemeCategory10);

    const pieColor = d3.scaleOrdinal()
        .domain(Object.keys(sizeNames).sort((a,b) => ['S','M','L'].indexOf(a) - ['S','M','L'].indexOf(b)))
        .range(['#1f77b4', '#2ca02c', '#ff7f0e']);

    // --- 1. PIE CHART (Overview) ---
    function drawPieChart() {
        const sizeCounts = d3.nest()
            .key(d => d.company_size)
            .rollup(v => v.length)
            .entries(originalData);

        const pie = d3.pie()
            .value(d => d.value)
            .sort(null);

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(pieChartRadius);

        const arcs = pieG.selectAll(".arc")
            .data(pie(sizeCounts))
            .enter()
            .append("g")
            .attr("class", "arc");

        arcs.append("path")
            .attr("d", arc)
            .attr("fill", d => pieColor(d.data.key))
            .attr("stroke", "white")
            .style("stroke-width", "2px");

        svg.append("text") // Pie chart title
            .attr("x", margin.left + pieChartWidth / 2)
            .attr("y", margin.top / 2 + 10)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .text("Company Size Distribution (Overview)");

        const legendRectSizePie = 15;
        const legendSpacingPie = 4;
        const legendPie = svg.selectAll('.legend-pie')
            .data(pieColor.domain())
            .enter()
            .append('g')
            .attr('class', 'legend-pie')
            .attr('transform', (d, i) => `translate(${margin.left + pieChartWidth + 20}, ${margin.top + i * (legendRectSizePie + legendSpacingPie)})`);

        legendPie.append('rect')
            .attr('width', legendRectSizePie)
            .attr('height', legendRectSizePie)
            .style('fill', pieColor)
            .style('stroke', pieColor);

        legendPie.append('text')
            .attr('x', legendRectSizePie + legendSpacingPie)
            .attr('y', legendRectSizePie - legendSpacingPie + 2)
            .style('font-size', '12px')
            .text(d => sizeNames[d] || d);
    }
    drawPieChart();


    // --- 2. BAR CHART ---
    function setupBarChart() {
     
        const avgSalaryByExp = d3.nest()
            .key(d => d.experience_level)
            .rollup(v => d3.mean(v, d => d.salary_in_usd))
            .entries(originalData);
        avgSalaryByExp.sort((a, b) => expLevelOrder.indexOf(a.key) - expLevelOrder.indexOf(b.key));

        xBar = d3.scaleBand()
            .domain(expLevelOrder) 
            .range([0, barChartWidth])
            .padding(0.2);

        yBar = d3.scaleLinear()
            .domain([0, d3.max(avgSalaryByExp, d => d.value) || 100000])
            .nice()
            .range([barChartHeight, 0]);

        xAxisBar = barG.append("g")
            .attr("class", "x-axis bar-axis")
            .attr("transform", `translate(0, ${barChartHeight})`)
            .call(d3.axisBottom(xBar).tickFormat(d => expLevelNames[d] || d))
            .selectAll("text")
              .attr("transform", "translate(-10,5)rotate(-30)")
              .style("text-anchor", "end");

        yAxisBar = barG.append("g")
            .attr("class", "y-axis bar-axis")
            .call(d3.axisLeft(yBar).ticks(10, "$,.0f"));

        barG.append("text") // X-axis label
            .attr("class", "x-axis-label")
            .attr("text-anchor", "middle")
            .attr("x", barChartWidth / 2)
            .attr("y", barChartHeight + margin.bottom - 25)
            .text("Experience Level");

        barG.append("text") // Y-axis label
            .attr("class", "y-axis-label")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("y", -margin.left + 40) 
            .attr("x", -barChartHeight / 2)
            .text("Average Salary (USD)");

        barG.append("text") // Bar chart title
            .attr("class", "chart-title")
            .attr("x", barChartWidth / 2)
            .attr("y", -margin.top / 2 + 10)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .text("Average Salary by Experience Level");


        const initialBarsData = expLevelOrder.map(level => ({
            key: level,
            value: (avgSalaryByExp.find(d => d.key === level) || {value: 0}).value
        }));
        
        barG.selectAll(".bar")
            .data(initialBarsData, d => d.key)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => xBar(d.key))
            .attr("y", d => yBar(d.value))
            .attr("width", xBar.bandwidth())
            .attr("height", d => barChartHeight - yBar(d.value))
            .attr("fill", d => expColor(d.key))
            .on("click", function(d) { handleBarClick(d); }); 
    }
    setupBarChart();

    // --- 3. PARALLEL COORDINATES PLOT (Advanced ) ---
    let pcpLines; 
    let pcpAxes;  

    function setupPCP() {
        dimensions.forEach(dim => {
            let domainExtent = d3.extent(originalData, d => d[dim]);
            if (dim === "salary_in_usd") {
                const padding = (domainExtent[1] - domainExtent[0]) * 0.05;
                const minVal = domainExtent[0] <= 0 ? domainExtent[0] : domainExtent[0] - padding;
                const maxVal = domainExtent[1] + padding;
                domainExtent = [minVal < 0 ? 0 : minVal, maxVal];
            }
            yPCP[dim] = d3.scaleLinear()
                .domain(domainExtent)
                .range([pcpHeight, 0])
                .nice();
        });
        yPCP["remote_ratio"].domain([0, 100]);
        const yearExtent = d3.extent(originalData, d => d.work_year);
        yPCP["work_year"].domain(yearExtent[0] === yearExtent[1] ? [yearExtent[0] - 0.5, yearExtent[1] + 0.5] : yearExtent).nice(originalData.length > 1 ? 4 : 1);

        xPCP = d3.scalePoint()
            .range([0, pcpWidth])
            .padding(1)
            .domain(dimensions);

        function path(d) {
            const points = dimensions.map(p => {
                const val = d[p];
                if (val !== undefined && val !== null && val >= yPCP[p].domain()[0] && val <= yPCP[p].domain()[1]) {
                    return [xPCP(p), yPCP[p](val)];
                }
                return null;
            }).filter(p => p !== null);
            if (points.length < 2) return "M0,0"; 
            return d3.line()(points);
        }

        pcpLines = pcpG.selectAll(".pcp-line")
            .data(originalData)
            .enter()
            .append("path")
            .attr("class", "pcp-line")
            .attr("d", path)
            .style("fill", "none")
            .style("stroke", d => expColor(d.experience_level))
            .style("stroke-width", "1.5px")
            .style("opacity", 0.7); 

        pcpAxes = pcpG.selectAll(".dimension")
            .data(dimensions)
            .enter()
            .append("g")
            .attr("class", "dimension pcp-axis")
            .attr("transform", d => `translate(${xPCP(d)}, 0)`);

        pcpAxes.append("g")
            .attr("class", "axis") 
            .each(function(d) {
                let axisFormat = null;
                if (d === 'salary_in_usd') axisFormat = "$,.2s";
                if (d === 'work_year') axisFormat = "d";
                d3.select(this).call(d3.axisLeft(yPCP[d]).ticks(5).tickFormat(d3.format(axisFormat)));
            })
            .append("text")
              .attr("class", "pcp-axis-title")
              .style("text-anchor", "middle")
              .attr("y", -12)
              .text(d => dimensionNames[d])
              .style("fill", "black")
              .style("font-size", "11px");

    
        pcpAxes.each(function(dimName) {
            d3.select(this).append("g")
                .attr("class", "brush")
                .call(d3.brushY()
                    .extent([[-10, 0], [10, pcpHeight]])
                    .on("start brush end", function() { 
                        const selection = d3.event.selection;
                        if (selection) {
                            activePCPBrushesExtents[dimName] = selection.map(yPCP[dimName].invert).sort((a, b) => b - a); // [max, min]
                        } else {
                            delete activePCPBrushesExtents[dimName];
                        }
                        updateDashboard();
                    })
                );
        });

        pcpG.append("text") 
            .attr("class", "chart-title")
            .attr("x", pcpWidth / 2)
            .attr("y", -marginPCP.top / 2 ) 
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .text("Salary vs Year vs Remote (by Experience)");

        // PCP Legend
        const pcpLegendYStart = pcpHeight + marginPCP.bottom - 25;
        const pcpLegendXStart = 0;
        pcpG.append("text")
           .attr("x", pcpLegendXStart)
           .attr("y", pcpLegendYStart - 10)
           .attr("text-anchor", "start")
           .style("font-size", "11px")
           .style("font-style", "italic")
           .text("Line colors indicate Experience Level:");
        const legendRectSizePCP = 15;
        const legendSpacingPCP = 4;
        const legendItemWidth = 85;
        const legendPCP = pcpG.selectAll('.legend-pcp')
            .data(expColor.domain())
            .enter()
            .append('g')
            .attr('class', 'legend-pcp')
            .attr('transform', (d, i) => `translate(${pcpLegendXStart + i * legendItemWidth}, ${pcpLegendYStart})`);
        legendPCP.append('rect')
            .attr('width', legendRectSizePCP)
            .attr('height', legendRectSizePCP)
            .style('fill', expColor)
            .style('stroke', expColor);
        legendPCP.append('text')
            .attr('x', legendRectSizePCP + legendSpacingPCP)
            .attr('y', legendRectSizePCP / 2 + 4)
            .style('font-size', '12px')
            .text(d => expLevelNames[d] || d);
    }
    setupPCP();


    // --- INTERACTION HANDLERS AND UPDATE FUNCTIONS ---

    function handleBarClick(d_bar) { 
        const clickedKey = d_bar.key;
        if (selectedExperienceLevelForPCP === clickedKey) {
            selectedExperienceLevelForPCP = null; 
        } else {
            selectedExperienceLevelForPCP = clickedKey;
        }
        updateDashboard();
    }

    function updateBarChart(filteredData) {
        const avgSalaryByExp = d3.nest()
            .key(d => d.experience_level)
            .rollup(v => v.length > 0 ? d3.mean(v, d => d.salary_in_usd) : 0)
            .entries(filteredData);

        
        const completeAvgSalaryByExp = expLevelOrder.map(level => {
            const found = avgSalaryByExp.find(d => d.key === level);
            return { key: level, value: found ? found.value : 0 };
        });

        yBar.domain([0, d3.max(completeAvgSalaryByExp, d => d.value) || 10000]).nice(); // Update y-axis domain, default if max is 0

        // Transition Y Axis (Substrate Transformation)
        barG.select(".y-axis.bar-axis")
            .transition().duration(500)
            .call(d3.axisLeft(yBar).ticks(10, "$,.0f"));

        const bars = barG.selectAll(".bar").data(completeAvgSalaryByExp, d => d.key);

        // Enter, Update, Exit pattern for bars
        bars.enter().append("rect")
            .attr("class", "bar")
            .attr("x", d => xBar(d.key))
            .attr("width", xBar.bandwidth())
            .attr("fill", d => expColor(d.key))
            .attr("y", barChartHeight) 
            .attr("height", 0)
            .on("click", function(d) { handleBarClick(d); })
          .merge(bars) 
            .transition().duration(500) 
            .attr("y", d => yBar(d.value))
            .attr("height", d => barChartHeight - yBar(d.value))
            .attr("fill", d => expColor(d.key)); 

        bars.exit()
            .transition().duration(500)
            .attr("y", barChartHeight)
            .attr("height", 0)
            .remove();

       
        barG.selectAll(".bar")
            .transition().duration(100) 
            .style("opacity", bar_d => {
                return selectedExperienceLevelForPCP === null || bar_d.key === selectedExperienceLevelForPCP ? 1 : 0.5;
            });
    }

    function updatePCPLines() {
        pcpLines 
            .transition().duration(300) 
            .style("stroke", d => {
                const isBrushedIn = Object.keys(activePCPBrushesExtents).length === 0 ||
                    Object.entries(activePCPBrushesExtents).every(([dim, extent]) => {
                        // extent is [maxVal, minVal] because of screen coordinates
                        return d[dim] >= extent[1] && d[dim] <= extent[0];
                    });
                const matchesExperience = selectedExperienceLevelForPCP === null || d.experience_level === selectedExperienceLevelForPCP;

                return (isBrushedIn && matchesExperience) ? expColor(d.experience_level) : "#ddd";
            })
            .style("opacity", d => {
                const isBrushedIn = Object.keys(activePCPBrushesExtents).length === 0 ||
                    Object.entries(activePCPBrushesExtents).every(([dim, extent]) => {
                         return d[dim] >= extent[1] && d[dim] <= extent[0];
                    });
                const matchesExperience = selectedExperienceLevelForPCP === null || d.experience_level === selectedExperienceLevelForPCP;

                return (isBrushedIn && matchesExperience) ? 0.7 : 0.05; 
            });
    }

    function updateDashboard() {
        let dataForBarChart = originalData;
        if (Object.keys(activePCPBrushesExtents).length > 0) {
            dataForBarChart = originalData.filter(d => {
                return Object.entries(activePCPBrushesExtents).every(([dim, extent]) => {
                    return d[dim] >= extent[1] && d[dim] <= extent[0];
                });
            });
        }
        updateBarChart(dataForBarChart);
        updatePCPLines();
    }

    
    updateDashboard();


}).catch(function(error) {
    console.error("Error loading or processing data:", error);
});