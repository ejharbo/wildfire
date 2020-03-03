// JavaScript file for TopBraid EDG Diagrams JS
// file: edg-diagrams.js

var edgdiagram = {

// ========================
// Workflow Diagram support
// ========================

initWorkflowDiagram : function (id, attributes, transitionLinks) {

     function setGraphEdges(e,label,qualifier,name,fromNode,toNode) {
        var rs = label[0].getClientRects(),
            width = rs[0].width,
            height = rs[0].height;
        g.setEdge(
            fromNode,
            toNode,
            {
                predicate: e.transition + qualifier,
                width: width,
                height: height
            },
            name
        );
    };

    var g = new dagre.graphlib.Graph({
        multigraph: true ,
    });

    g.setGraph({
     rankdir: "TB"
    });

    g.setDefaultEdgeLabel(function() {
        return {};
    });

    $('#' + id)
        .children('.swauml-start-node, .swauml-trigger-node, .swauml-state-node, .swauml-transition-node')
        .each(function(index, e) {
            var rs = e.getClientRects();
            var width = rs[0].width ;
            var height = rs[0].height ;
            var iri = $(e).attr('about');
            g.setNode(iri, { width: width, height: height });
        });

    $.each(transitionLinks, function(index, e) {
    if (e.linkType === "TRANSITION") {
      var fromName  = e.transition + '_FROM--' + e.fromState,
          toName    = e.transition + '_TO--' + e.toState,
          fromLabel = $('#' + id).children('[about="label--' + e.fromState + '--' + e.transition + '--' + e.transition + '_FROM"]'),
          toLabel   = $('#' + id).children('[about="label--' + e.transition + '--' + e.toState + '--' + e.transition + '_TO' + '"]');

      setGraphEdges(e,fromLabel,"_FROM",fromName,e.fromState,e.transition);
      setGraphEdges(e,toLabel,"_TO",toName,e.transition,e.toState);
      }
    else if (e.linkType === "NORMAL") {
        var label = $('#' + id).children('[about="label--' + e.fromState + '--' + e.toState + '--' + e.transition +'"]'),
            name  = e.transition;
        setGraphEdges(e,label,"",name,e.fromState,e.toState);
    }
  });

    dagre.layout(g);

    var nodeXoffset = 20,
        nodeYoffset = 20,
        edgeXoffset = 20,
        edgeYoffset = 20,
        maxX = 60,
        maxY = 60;

    g.nodes().forEach(function(v) {
        var node = g.node(v);
        var nodeElement = $('#' + id).children('[about="' + v + '"]');
        nodeElement.css('left', nodeXoffset + node.x - node.width / 2);
        nodeElement.css('top', nodeYoffset + node.y - node.height / 2);
        maxX = Math.max(maxX, nodeXoffset + node.x + node.width / 2 + nodeXoffset);
        maxY = Math.max(maxY, nodeYoffset + node.y + node.height / 2 + nodeYoffset);
    });

// Round the corners of the nodes

//     g.nodes().forEach(function(v) {
//       var node = g.node(v);
//       node.rx = node.ry = 5;
//       });

    g.edges().forEach(function(e) {
        var edge = g.edge(e);
        var origin = edge.points[0];
        var points = '';
        var lineElement;

        $.each(edge.points, function(index, element) {
            points +=
                '' + (edgeXoffset + edge.points[index].x) + ',' + (edgeYoffset + edge.points[index].y) + ' ';
        });

        if (edge.predicate) {
            lineElement = $('#' + id).find(
                '[about="' + e.v + '--' + e.w + '--' + edge.predicate + '"]'
            );

            lineElement.attr('points', points);
            var labelElement = $('#' + id).find(
                '[about="label--' + e.v + '--' + e.w + '--' + edge.predicate + '"]');

             var xValue = nodeXoffset + edge.x - edge.width / 2,
                 yValue = nodeYoffset + edge.y - edge.height / 2;

            labelElement.css('left', xValue);
            labelElement.css('top', yValue);

            maxX = Math.max(maxX, nodeXoffset + edge.x + edge.width / 2 );
            maxY = Math.max(maxY, nodeYoffset + edge.y + edge.height / 2 );
        } else {
            lineElement = $('#' + id).find('[about="' + e.v + '--' + e.w + '"]');
            lineElement.attr('points', points);
        }
    });

    $('#' + id).css('height', maxY + 'px');
    $('#' + id).css('width', maxX + 'px');
    $('#' + id + ' svg')
        .find('polyline')
        .appendTo($('#' + id + ' svg'));
  } ,


// ========================
// Instance Diagram support
// ========================

initInstanceDiagram : function (id, attributes, associationEdges) {
    // $("#" + id).children(".swauml-instance-node").draggable({ containment: "parent" });

    var g = new dagre.graphlib.Graph({
        multigraph: true ,
    });

    g.setGraph({
     rankdir: "TB"
    });

    g.setDefaultEdgeLabel(function() {
        return {};
    });

    $('#' + id)
        .children('.swauml-instance-node')
        .each(function(index, e) {
            var rs = e.getClientRects();
            var width = rs[0].width ;
            var height = rs[0].height ;
            var iri = $(e).attr('about');
            g.setNode(iri, { width: width, height: height });
        });

//     $.each(subClassEdges, function(index, e) {
//         g.setEdge(e.superClass, e.subClass, {}, 'subClass-' + e.superClass + ' ' + e.subClass);
//     });

    $.each(associationEdges, function(index, e) {
        var label = $('#' + id).children(
            '[about="label ' + e.sourceEntity + ' ' + e.targetEntity + ' ' + e.association + '"]'
        );
        var rs = label[0].getClientRects();
        var width = rs[0].width;
        var height = rs[0].height;
        var name = e.association + ' ' + e.sourceEntity + ' ' + e.targetEntity;
        g.setEdge(
            e.sourceEntity,
            e.targetEntity,
            {
                predicate: e.association,
                width: width,
                height: height
            },
            name
        );
    });

    dagre.layout(g);

    var offset = 20;
    var edgeOffset = 20;
    var maxX = 40;
    var maxY = 40;



    g.nodes().forEach(function(v) {
        var node = g.node(v);
        var nodeElement = $('#' + id).children('[about="' + v + '"]');
        nodeElement.css('left', offset + node.x - node.width / 2);
        nodeElement.css('top', offset + node.y - node.height / 2);
        maxX = Math.max(maxX, offset + node.x + node.width / 2 + offset);
        maxY = Math.max(maxY, offset + node.y + node.height / 2 + offset);
    });

// Round the corners of the nodes
//     g.nodes().forEach(function(v) {
//       var node = g.node(v);
//       node.rx = node.ry = 5;
//       });

    g.edges().forEach(function(e) {
        var edge = g.edge(e);
        var origin = edge.points[0];
        var points = '';
        var lineElement;
        $.each(edge.points, function(index, element) {
            points +=
                '' + (edgeOffset + edge.points[index].x) + ',' + (edgeOffset + edge.points[index].y) + ' ';
        });
        if (edge.predicate) {
            lineElement = $('#' + id).find(
                '[about="' + e.v + ' ' + e.w + ' ' + edge.predicate + '"]'
            );
            lineElement.attr('points', points);
            var labelElement = $('#' + id).find(
                '[about="label ' + e.v + ' ' + e.w + ' ' + edge.predicate + '"]'
            );
            labelElement.css('left', offset + edge.x - edge.width / 2);
            labelElement.css('top', offset + edge.y - edge.height / 2);
            maxX = Math.max(maxX, offset + edge.x + edge.width / 2 + offset);
            maxY = Math.max(maxY, offset + edge.y + edge.height / 2 + offset);
        } else {
            lineElement = $('#' + id).find('[about="' + e.v + ' ' + e.w + '"]');
            lineElement.attr('points', points);
        }
    });

    $('#' + id).css('height', maxY + 'px');
    $('#' + id).css('width', maxX + 'px');
    $('#' + id + ' svg')
        .find('polyline')
        .appendTo($('#' + id + ' svg'));
  }
}
