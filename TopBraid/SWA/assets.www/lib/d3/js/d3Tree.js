/**
 * JavaScript file for TopBraid EDG Diagrams JS
 * file:  d3Tree.js
 * The JavaScript code backing the D3 tree visualization for a relationship
 */

// The top-level JS object for the D3 tree
var d3Tree = {
    margin : {top: 10, right: 120, bottom: 20, left: 300},
    width : 0,
    height : 0,
    i : 0,
    duration : 750,
    root : null,
    tree : null,
    svg : null,
    treemap: null,

    linkHorizontal : d3.linkHorizontal()
          .x(function(d) {
          return d.x;
         })
         .y(function(d) {
         return d.y;
     }),

	init : function() {
		d3Tree.width = window.innerWidth - d3Tree.margin.right - d3Tree.margin.left;
		d3Tree.height = window.innerHeight - d3Tree.margin.top - d3Tree.margin.bottom;
		d3Tree.tree = d3.tree().size([d3Tree.height, d3Tree.width]);
		$("svg").remove();
		d3Tree.svg = d3.select("body").append("svg")
			.attr("width", d3Tree.width + d3Tree.margin.right + d3Tree.margin.left)
			.attr("height", d3Tree.height + d3Tree.margin.top + d3Tree.margin.bottom)
			.append("g")
			.attr("transform", "translate(" + d3Tree.margin.left + "," + d3Tree.margin.top + ")");
	},

// clear the svg area
// this is needed when a diagram is on the canvas and the user chooses another property,
// but that property has no links to be displayed.

    clear : function() {
        $("svg").remove();
    },

// Collapse the node and all it's children

	collapse : function(node) {
		if (node.children) {
			node._children = node.children;
			node._children.forEach(d3Tree.collapse);
			node.children = null;
		}
	},

	flareFunction : function (error, flare) {

    var orientations = {
       "top2bottom": {
        size: [d3Tree.width, d3Tree.height],
        x: function(d) { return d.x; },
        y: function(d) { return d.y; }
       },
        "right2left": {
        size: [d3Tree.height, d3Tree.width],
        x: function(d) { return width - d.y; },
        y: function(d) { return d.x; }
        },
        "bottom2top": {
        size: [d3Tree.width, d3Tree.height],
        x: function(d) { return d.x; },
        y: function(d) { return height - d.y; }
        },
        "left2right": {
         size: [d3Tree.height, d3Tree.width],
        x: function(d) { return d.y; },
        y: function(d) { return d.x; }
        }
      };

// only support left to right for now

        var o = orientations.left2right;

// declares a tree layout and assigns the size

        d3Tree.treemap = d3.tree().size(o.size);

// Compute the layout.

// Assigns parent, children, height, depth
        d3Tree.root = d3.hierarchy(flare, function(d) { return d.children; });
        d3Tree.root.x0 = d3Tree.height / 2;
        d3Tree.root.y0 = 0;

		d3Tree.root.children.forEach(d3Tree.collapse);

		try {
		    d3Tree.update(d3Tree.root);
		    }
		catch (err){
		 console.log(err)
		 }
	},


   update : function (source) {
   // Assigns the x and y position for the nodes
   var treemap = d3Tree.treemap ;
   var treeData = treemap(d3Tree.root);

  // Compute the new tree layout.
   var nodes = treeData.descendants(),
      links = treeData.descendants().slice(1);

  // Normalize for fixed-depth.
  nodes.forEach(function(d){ d.y = d.depth * 180});

  // ****************** Nodes section ***************************
  var i = 0;

  // Update the nodes...
  var node = d3Tree.svg.selectAll('g.node')
      .data(nodes, function(d) {return d.id || (d.id = ++i); });

  // Enter any new modes at the parent's previous position.
  var nodeEnter = node.enter().append('g')
      .attr('class', 'node')
      .attr("transform", function(d) {
        return "translate(" + source.y0 + "," + source.x0 + ")";
    })
    .on('click', click);

  // Add Circle for the nodes
  nodeEnter.append('circle')
      .attr('class', 'node')
      .attr('r', 1e-6)
      .style("fill", function(d) {
          return d._children ? "lightsteelblue" : "#fff";
      });

  // Add labels for the nodes
  nodeEnter.append('text')
      .attr("dy", ".35em")
      .attr("x", function(d) {
          return d.children || d._children ? -13 : 13;
      })
      .attr("text-anchor", function(d) {
          return d.children || d._children ? "end" : "start";
      })
      .text(function(d) { return d.data.name; });

  // UPDATE
  var nodeUpdate = nodeEnter.merge(node);

  // Transition to the proper position for the node
  nodeUpdate.transition()
    .duration(d3Tree.duration)
    .attr("transform", function(d) {
        return "translate(" + d.y + "," + d.x + ")";
     });

  // Update the node attributes and style
  nodeUpdate.select('circle.node')
    .attr('r', 5)
    .style("fill", function(d) {
        return d._children ? "lightsteelblue" : "#fff";
    })
    .attr('cursor', 'pointer');


  // Remove any exiting nodes
  var nodeExit = node.exit().transition()
      .duration(d3Tree.duration)
      .attr("transform", function(d) {
          return "translate(" + source.y + "," + source.x + ")";
      })
      .remove();

  // On exit reduce the node circles size to 0
  nodeExit.select('circle')
    .attr('r', 1e-6);

  // On exit reduce the opacity of text labels
  nodeExit.select('text')
    .style('fill-opacity', 1e-6);

  // ****************** links section ***************************

  // Update the links...
  var link = d3Tree.svg.selectAll('path.link')
      .data(links, function(d) { return d.id; });

  // Enter any new links at the parent's previous position.
  var linkEnter = link.enter().insert('path', "g")
      .attr("class", "link")
      .attr('d', function(d){
        var o = {x: source.x0, y: source.y0}
        return diagonal(o, o)
      });

  // UPDATE
  var linkUpdate = linkEnter.merge(link);

  // Transition back to the parent element position
  linkUpdate.transition()
      .duration(d3Tree.duration)
      .attr('d', function(d){ return diagonal(d, d.parent) });

  // Remove any exiting links
  var linkExit = link.exit().transition()
      .duration(d3Tree.duration)
      .attr('d', function(d) {
        var o = {x: source.x, y: source.y}
        return diagonal(o, o)
      })
      .remove();

  // Store the old positions for transition.
  nodes.forEach(function(d){
    d.x0 = d.x;
    d.y0 = d.y;
  });

  // Creates a curved (diagonal) path from parent to the child nodes
  function diagonal(s, d) {

    path = `M ${s.y} ${s.x}
            C ${(s.y + d.y) / 2} ${s.x},
              ${(s.y + d.y) / 2} ${d.x},
              ${d.y} ${d.x}`

    return path
  };

  // Toggle children on click.
  function click(d) {
    if (d.children) {
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }
    d3Tree.update(d);
  }
}

}
