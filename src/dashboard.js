Telemetry.init(function(){
  $("#histogram-filter").histogramfilter({
    synchronizeStateWithHash:   true,
    defaultVersion:             function(versions) {
      var nightlies = versions.filter(function(version) {
        return version.substr(0,8) == "nightly/";
      });
      nightlies.sort();
      return nightlies.pop() || versions.sort().pop();
    },
    selectorType:   BootstrapSelector,
    evolutionOver:  $('input[name=evo-type]:radio:checked').val(),
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
      key:      "Count",
      values:   vals,
      color:    "#0000ff"
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

function update(hgramEvo) {
  if(!hgramEvo) {
    hgramEvo = lastHistogramEvo;
  }
  lastHistogramEvo = hgramEvo;

  // Add a show-<kind> class to #content
  $("#content").removeClass('show-linear show-exponential');
  $("#content").removeClass('show-flag show-boolean show-enumerated');
  $("#content").addClass('show-' + hgramEvo.kind());

  $("#measure").text(hgramEvo.measure());
  $("#description").text(hgramEvo.description());

  function updateProps(extent) {
    var hgram;
    var dates = hgramEvo.dates();
    if(extent){
      var start = new Date(extent[0]);
      var end   = new Date(extent[1]);
      // Normalize dates
      start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      end   = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      hgram = hgramEvo.range(start, end);
      // Filter dates
      dates = dates.filter(function(date) { return start <= date && date <= end;});
    } else {
      hgram = hgramEvo.range();
    }

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
    $('#prop-kind')       .text(hgram.kind());
    $('#prop-submissions').text(fmt(hgram.submissions()));
    $('#prop-count')      .text(fmt(hgram.count()));
    $('#prop-dates')      .text(d3.format('s')(dates.length));
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
  var agrdata = [];
  drawEvolution = function() {
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

    var data = [{
      key:      "Submissions",
      bar:      true, // This is hacked :)
      yAxis:    2,
      values:   submissions,
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
      hgramEvo.each(function(date, hgram) {
        date = date.getTime();
        if (!sanitizeData || hgram.submissions() >= submissionsCutoff) {
          var mean = hgram.mean();
          if (mean >= 0) {
            means.push({x: date, y: mean});
          }
          [5, 25, 50, 75, 95].forEach(function(p) {
            var v = hgram.percentile(p);
            // Weird negative values can cause d3 etc. to freak out - see Bug 984928 
            if (v >= 0) {
              ps[p].push({x: date, y: v});
            }
          });
        } else {
          // Set everything to zero to keep the graphs looking nice.
          means.push({x: date, y: 0});
          [5, 25, 50, 75, 95].forEach(function(p) {
            ps[p].push({x: date, y: 0});
          });
        }
      });
      data.push({
        key:      "Mean",
        yAxis:    1,
        values:   means,
      },{
        key:      "5th percentile",
        yAxis:    1,
        values:   ps['5'],
      },{
        key:      "25th percentile",
        yAxis:    1,
        values:   ps['25'],
      },{
        key:      "median",
        yAxis:    1,
        values:   ps['50'],
      },{
        key:      "75th percentile",
        yAxis:    1,
        values:   ps['75'],
      },{
        key:      "95th percentile",
        yAxis:    1,
        values:   ps['95'],
      });
    }

    // data: array of {key, yAxis, values}, where values are {x: date, y: value}
    // labels: array of keys
    // newdata: array of [date, value1, value2, ... ] for each key.
    var labels = ["Date"];    
    data.forEach(function(d) {
	    labels.push(d.key);
    });

    var newdata = [];
    // copy dates from first key
    for (i = 0; i < data[0].values.length; ++i) {
	newdata.push([data[0].values[i].x]);  // date
    }
    // append all values on that date
    data.forEach(function(d) {
        for (i = 0; i < d.values.length; ++i) {
	    newdata[i].push(d.values[i].y);  // values
	}
    });
	agrdata.push(newdata);
	console.log("----agregated data", agrdata, "agregated length", agrdata.length );
	

    
    var g = new Dygraph(document.getElementById("evolution"), newdata,
                        {
			  drawPoints: true,
			  showRoller: false,
			  labels: labels,
			  series: {
			      "Submissions": {
				  axis: 'y2'
			      },
			  },
			  axes: {
			      x: {
                        axisLabelFormatter: function(x) {
                           var a = new Date(x);
	var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = a.getFullYear();
    console.log(year);                           
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    var time = month;
    return date + ' ' + month + ' ' + year;
                           }
			         },
			      y2: {
				  independentTicks: true
			      }
			  }

		      });

    /*

    var focusChart = evolutionchart()
      .margin({top: 10, right: 80, bottom: 40, left: 80});

    focusChart.xAxis
      .tickFormat(function(d) {
        return d3.time.format('%Y/%m/%d')(new Date(d));
      });
    focusChart.x2Axis
      .tickFormat(function(d) {
        return d3.time.format('%Y/%m/%d')(new Date(d));
      });
    focusChart.y1Axis
        .tickFormat(fmt);
    focusChart.y2Axis
        .tickFormat(fmt);
    focusChart.y3Axis
        .tickFormat(fmt);
    focusChart.y4Axis
        .tickFormat(fmt);

    d3.select("#evolution")
      .datum(data)
      .transition().duration(500).call(focusChart);

    nv.utils.windowResize(
      function() {
        focusChart.update();
      }
    );

    focusChart.setSelectionChangeCallback(updateProps);

    */
  };

  drawEvolution();

  updateProps();
}
