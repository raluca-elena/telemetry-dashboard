var g;
var data;
var labels;
Telemetry.init(function(){
  $("#histogram-filter").histogramfilter({
    synchronizeStateWithHash: true,
    defaultVersion: function(versions) {
      var nightlies = versions.filter(function(version) {
        return version.substr(0,8) == "nightly/";
      });
      nightlies.sort();
      return nightlies.pop() || versions.sort().pop();
    },
    //versionSelectorType: BootstrapSelector,
    defaultSelectorType: BootstrapSelector,
	
    evolutionOver: $('input[name=evo-type]:radio:checked').val(),
  });

  $("#histogram-filter").bind("histogramfilterchange", function(event, data) {

    // Get HistogramEvolution instance
    var hgramEvo = data.histogram;

    if (hgramEvo !== null) {
      $("#content").fadeIn();
      $("#spinner").fadeOut();
      update(hgramEvo);
    } else {
      $("#content").fadeOut();
      $("#spinner").fadeIn();
    }
  });

  $('input[name=evo-type]:radio').change(function() {
    var evoType = $('input[name=evo-type]:radio:checked').val();
    $("#histogram-filter").histogramfilter('option', 'evolutionOver', evoType);
    console.log(evoType);
  });

  $('input[name=render-type]:radio').change(function() {
    update();
  });
  $('input[name=sanitize-pref]:checkbox').change(function() {
    update();
  });
});

/** Format numbers */
function fmt(number) {
  if(number == Infinity)
    return "Infinity";
  if(number == -Infinity)
    return "-Infinity";
  if(isNaN(number))
    return "NaN";
  var prefix = d3.formatPrefix(number ,'s')
  return Math.round(prefix.scale(number) * 100) / 100 + prefix.symbol;
}


function renderHistogramTable(hgram) {
  $('#histogram').hide();
  $('#histogram-table').show();
  var body = $('#histogram-table').find('tbody')
  body.empty();

  body.append.apply(body, hgram.map(function(count, start, end, index) {
    return $('<tr>')
      .append($('<td>').text(fmt(start)))
      .append($('<td>').text(fmt(end)))
      .append($('<td>').text(fmt(count)));
  }));
}


function renderHistogramGraph(hgram) {
  $('#histogram-table').hide();
  $('#histogram').show();
  nv.addGraph(function(){
    var total = hgram.count();
    var vals = hgram.map(function(count, start, end, index) {
      return {
        x: [start, end],
        y: count,
        percent: count / total
      };
    });

    var data = [{
      key: "Count",
      values: vals,
      color: "#0000ff"
    }];

    var chart = histogramchart()
     .margin({top: 20, right: 80, bottom: 40, left: 80});
    chart.yAxis.tickFormat(fmt);
    chart.xAxis.tickFormat(function(bucket) {return fmt(bucket[0]);});
    d3.select("#histogram")
      .datum(data)
      .transition().duration(500).call(chart);

    nv.utils.windowResize(
      function() {
        chart.update();
      }
    );
    return chart;
  });
}



var renderHistogramTime = null;
var lastHistogramEvo = null;
var _exportHgram = null;
var _lastBlobUrl = null;

// Generate download on mousedown
$('#export-link').mousedown(function(){
  if(_lastBlobUrl){
    URL.revokeObjectURL(_lastBlobUrl);
    _lastBlobUrl = null;
  }
  var csv = "start,\tend,\tcount\n";
  csv += _exportHgram.map(function(count, start, end, index) {
    return [start, end, count].join(",\t");
  }).join("\n");

   _lastBlobUrl = URL.createObjectURL(new Blob([csv]));
   $('#export-link')[0].href = _lastBlobUrl;
   $('#export-link')[0].download = _exportHgram.measure() + ".csv";
});
///---
function updateProps(hgramEvo) {
  var dates = hgramEvo.dates();
  var hgram = hgramEvo.range();
  

  _exportHgram = hgram;

  dateFormat = d3.time.format('%Y/%m/%d');
  var dateRange = "";
  if (dates.length == 0) {
    dateRange = "None";
  } else if (dates.length == 1) {
    dateRange = dateFormat(dates[0]);
  } else {
    var last = dates.length - 1;
    dateRange = dateFormat(dates[0]) + " to " + dateFormat(dates[last]);
  }

  // Set common properties
  $('#prop-kind') .text(hgram.kind());
  $('#prop-submissions').text(fmt(hgram.submissions()));
  $('#prop-count') .text(fmt(hgram.count()));
  $('#prop-dates') .text(d3.format('s')(dates.length));
  $('#prop-date-range') .text(dateRange);

  // Set linear only properties
  if (hgram.kind() == 'linear') {
    $('#prop-mean').text(fmt(hgram.mean()));
    $('#prop-standardDeviation').text(fmt(hgram.standardDeviation()));
  }

  // Set exponential only properties
  if (hgram.kind() == 'exponential') {
    $('#prop-mean2')
      .text(fmt(hgram.mean()));
    $('#prop-geometricMean')
      .text(fmt(hgram.geometricMean()));
    $('#prop-geometricStandardDeviation')
      .text(fmt(hgram.geometricStandardDeviation()));
  }

  // Set percentiles if linear or exponential
  if (hgram.kind() == 'linear' || hgram.kind() == 'exponential') {
      $('#prop-p5').text(fmt(hgram.percentile(5)));
      $('#prop-p25').text(fmt(hgram.percentile(25)));
      $('#prop-p50').text(fmt(hgram.percentile(50)));
      $('#prop-p75').text(fmt(hgram.percentile(75)));
      $('#prop-p95').text(fmt(hgram.percentile(95)));
  }

  if(renderHistogramTime) {
    clearTimeout(renderHistogramTime);
  }
  renderHistogramTime = setTimeout(function() {
    var renderType = $('input[name=render-type]:radio:checked').val();
    if(renderType == 'Table') {
      renderHistogramTable(hgram)
    } else {
      renderHistogramGraph(hgram);
    }
  }, 100);
}
//---

var addedData = [];
var allHistograms = [];

function update(hgramEvo) {
  if(!hgramEvo) {
    hgramEvo = lastHistogramEvo;
  }
  lastHistogramEvo = hgramEvo;
  allHistograms.push(hgramEvo);  

  // Add a show-<kind> class to #content
  $("#content").removeClass('show-linear show-exponential');
  $("#content").removeClass('show-flag show-boolean show-enumerated');
  $("#content").addClass('show-' + hgramEvo.kind());

  $("#measure").text(hgramEvo.measure());
  $("#description").text(hgramEvo.description());
  
  //all the helper functions should be stored some other place if possible
  function getDateFormatted(date)
  {
   var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var year = date.getFullYear();
      var month = months[date.getMonth()];
      var date = date.getDate();
      var time = month;
      return date + ' ' + month + ' ' + year;
  }
  
  
  function prepareData(hgramEvo)
  {
      var maxSubmissions = 0;

      // Whether we actually filter submissions is controllable via the
      // 'sanitize-pref' preference.
      var sanitizeData = $('input[name=sanitize-pref]:checkbox').is(':checked');

      var submissions = hgramEvo.map(function(date, hgram) {
        if (hgram.submissions() > maxSubmissions) {
          maxSubmissions = hgram.submissions();
        }

        return {x: date.getTime(), y: hgram.submissions()};
      });

        data = [{
        key: "Submissions",
        bar: true, // This is hacked :)
        yAxis: 2,
        values: submissions,
      }];

      // Don't crap up the percentiles / means with lines based on a tiny number
      // of submissions. Flatten them all to zero if there are less than this
      // many submissions.
      // The cutoff is the lesser of 100 or 1% of the maximum number of
      // submissions we saw.
      var submissionsCutoff = Math.min(maxSubmissions / 100, 100);

      if(hgramEvo.kind() == 'linear' || hgramEvo.kind() == 'exponential') {
        var means = [];
        // Percentile series
        var ps = {};
        [5, 25, 50, 75, 95].forEach(function(p) {
          ps[p] = [];
        });
        hgramEvo.each(function(date, hgram)
   {
          date = date.getTime();
   date = getDateFormatted(new Date(date));

   if (!sanitizeData || hgram.submissions() >= submissionsCutoff)
   {
   		var mean = hgram.mean();
        if (mean >= 0)
   		{
             means.push({x: date, y: mean});
        }
        [5, 25, 50, 75, 95].forEach(function(p)
   		{
        	var v = hgram.percentile(p);
            // Weird negative values can cause d3 etc. to freak out - see Bug 984928
            if (v >= 0)
   			{
            	ps[p].push({x: date, y: v});
            }
         });
   }
   else
   {
            // Set everything to zero to keep the graphs looking nice.
           means.push({x: date, y: 0});
             //means.push({x: getDateFormatted(date), y: 0});
             [5, 25, 50, 75, 95].forEach(function(p)
   {
               ps[p].push({x: date, y: 0});
             });
          }
        });


        data.push(
   {
          key: "Mean",
          yAxis: 1,
          values: means,
        },
   {
          key: "5th percentile",
          yAxis: 1,
          values: ps['5'],
        },
   {
          key: "25th percentile",
          yAxis: 1,
          values: ps['25'],
        },
   {
          key: "median",
          yAxis: 1,
          values: ps['50'],
        },
   {
          key: "75th percentile",
          yAxis: 1,
          values: ps['75'],
        },
   {
          key: "95th percentile",
          yAxis: 1,
          values: ps['95'],
        });
      }

      // data: array of {key, yAxis, values}, where values are {x: date, y: value}
      // labels: array of keys
      // newdata: array of [date, value1, value2, ... ] for each key.
     

    return data

  }
  data = prepareData(hgramEvo);
  function constructLabels(data)
  {
   		labels = ["Date"];
      //var labels = [];
   		data.forEach(function(d)
		{
   		 	labels.push(d.key);
      	});
		return labels;
  }
  
  labels = constructLabels(data);
  
  function modifyData(data)
  {
      var newdata = [];
      // copy dates from first key
      for (i = 0; i < data[0].values.length; ++i)
	  {
   	   		newdata.push([data[0].values[i].x]); // date
      }
      // append all values on that date
      data.forEach(function(d)
	  {
          for (i = 0; i < d.values.length; ++i)
		  {
   		   		newdata[i].push(d.values[i].y); // values
  		  }
      });
	  return newdata;

  }
  newdata = modifyData(data);
  ///////////////////////////
  var datas = [];
  function constructLabels1(oldFormatDates)
  {
	  var i;
	  var j;
	  var allLabels = ["Date"];
	  var allLabels = [];
	  	  for (i = 0; i < oldFormatDates.length; i++)
	  {	  
		  var x = constructLabels(oldFormatDates[i]);		  
		  allLabels = allLabels.concat(x);		  
	  }
	  var j;
	  for(j = 1; j < allLabels.length; j++)
	  {
		console.log("allLabels[i] is:", allLabels[j]);
		if(allLabels[j]=="Date")
		{
			allLabels.splice(j, 1);
		}
		}	  
	  return allLabels;
  }
  //------
  var oldFormatDates = [];
  oldFormatDates.push(data);
  oldFormatDates.push(data);
  var allLabels = constructLabels1(oldFormatDates);  
  datas.push(newdata);
  datas.push(newdata);
   //-------------construct agregate data from newdata
  function agregateDates(datas)
  {
	  ////mimic a set
	  var setOfDates = {};
	  var i;
	  var j;
	  for (i = 0; i < datas.length; i++)
	  {
		  for (j = 0; j < datas[i].length; j++)
		  {
			  if (datas[i][j][0] in setOfDates)
			  {
				  //console.log("i am in if and datas[i][j][0] is ", datas[i][j][0]);
				  continue;
			  }
			  else
			  	setOfDates[datas[i][j][0]] = true;
		  }
	  }
	  //setOfDates is a dict having entries unit_time:true
	  return setOfDates;  
  }
  //all the dates are in setOfDates date:true
  //level is number of the set of data in datas
  //datas is the list of datas
  //dict is of data: label1, labes2...
  function headerList(setOfDates)
  {
	  var i;
	  var dict = [];
	  for(var key in setOfDates)
	  	dict.push([key]);
	  return dict;
  }
  setOfDates = agregateDates(datas);
  //console.log("-----set of dates -----", setOfDates);
  var acc = headerList(setOfDates);
  //console.log("the acc is    ", acc);
  
  function agregOneStepData(datas,level, setOfDates, acc)
  {
	  var j;
	  for(j=0; j < acc.length; j++)
	  {
		  var i;
		  var hasData = false;
		  for(i = 0; i < datas[level].length; i++)
		  {
			  if (datas[level][i][0] == acc[j][0])
			  {
				  var y = datas[level][i].slice(1);
				  //console.log("------datas[level][i].slice(0, 1)", y);
				  //console.log("acc inainte", acc[j]);
				  acc[j] = acc[j].concat(y);
				  //console.log("acc dupa", acc[j]);
			  	  hasData = true;
				  break;
			  }
		  }
		  if (hasData == false)
		  {
			  
			  var i;
			  for(i = 0; i < datas[level][1].length-1; i++)
				  acc[j] = acc[j].concat(null);
		   }
	  }
	  //console.log("acc is -------  ", acc);
	  return acc;
  }
  //console.log("my set of dates looks like------", setOfDates);
  var i;
  for(i = 0; i < datas.length; i++)
  {
  		var y = agregOneStepData(datas, i, setOfDates, acc);
  	  	//console.log("y is %%%%%%%%%%%%%%", y);
	}
  ///////////////////////////
  
  drawEvolution = function(newData) {   
     g = new Dygraph(document.getElementById("evolution"), acc,
               {
				   drawPoints: true,
				   showRoller: false,
				   labels: allLabels,
				   labelsDiv: document.getElementById("labels"),
				   series: {"Submissions": {axis: 'y2'},},
				   axes: {x: {axisLabelFormatter: function(x) {return getDateFormatted(new Date(x));}},
				   y2: {independentTicks: true}}

			   	});
	function createCheckbox(name, nameofmeasure, chk) 
	{
					$('<input/>', {id: name,
								 type: 'Checkbox',
							  checked: chk,}).appendTo('#measurement-selectors').change(function() {change1(this);});
				    $('<label/>', {for: name,
								  text: nameofmeasure}).appendTo('#measurement-selectors');
	 }

    for (i = 1; i <labels.length; i++)
    {
	   var id = "check"+i;
	   createCheckbox(id, labels[i], true);	
    }

    $('<button/>', {
    text: "checkAll",
    id: 'checkAll',
    click: function () { bahaviorAppliedToAll(true);}
    }).appendTo('#measurement-selectors');

    $('<button/>', {
    text: "checkNone",
    id: 'checkNone',
    click: function () { bahaviorAppliedToAll(false);}
    }).appendTo('#measurement-selectors');

	function bahaviorAppliedToAll(bool)
	{
		var i=0;
		$('#measurement-selectors').children('input').each(function () {
			this.checked=bool;
			g.setVisibility(i,bool);
			i++;
		});
	}
  };

 drawEvolution();
 updateProps(hgramEvo);
}

function change1(el) {
var i;
for (i = 1; i<= labels.length; i++)
{
if (el.id === ("check"+i)){
g.setVisibility(i-1, el.checked);
break;
}
}



}
