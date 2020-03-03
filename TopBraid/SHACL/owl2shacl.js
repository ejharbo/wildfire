// JavaScript file for the OWL2SHACL converter
// Contains JavaScript functions that produce mappings for the "difficult" cases
// such as converting an rdf:List of OWL classes into a similar rdf:List of SHACL shapes

function owlAllValuesFromUnion2shClassOrDatatype($this) {
	
	// For all restrictions that have a bnode union as its owl:allValuesFrom
	// create a new rdf:List of corresponding SHACL shapes where each list
	// has either sh:class or sh:datatype constraints.
	var results = [];
	$data.query().
		match($this, "rdfs:subClassOf", "?superClass").
		match("?superClass", "rdf:type", "owl:Restriction").
		match("?superClass", "owl:allValuesFrom", "?allValuesFrom").
		match("?allValuesFrom", "owl:unionOf", "?unionOf").
		match("?superClass", "owl:onProperty", "?property").
		match($this, "sh:property", "?propertyShape").
		match("?propertyShape", "sh:path", "?property").
		filter(function(sol) { return sol.superClass.isBlankNode() && sol.allValuesFrom.isBlankNode() } ).
		forEach(function(sol) {
			var oldArray = new RDFQueryUtil($data).rdfListToArray(sol.unionOf);
			var orList = createShapeList(oldArray, 0, results, function(node) {
				return isRDFSDatatype(node) ? T("sh:datatype") : T("sh:class")
			});
			results.push([sol.propertyShape, T("sh:or"), orList]);
			results.push([sol.superClass, T("<http://datashapes.org/owl2shacl#mappedTo>"), T("true")]);
		});
	return results;
}


function owlSomeValuesFromUnion2dashHasValueWithClass($this) {
	
	// For all restrictions that have a bnode union as its owl:someValuesFrom
	// create a new rdf:List of corresponding SHACL shapes where each list
	// member has a dash:hasValueWithClass constraint.
	// This currently does not handle the case where a list member is a datatype
	var results = [];
	$data.query().
		match($this, "rdfs:subClassOf", "?superClass").
		match("?superClass", "rdf:type", "owl:Restriction").
		match("?superClass", "owl:someValuesFrom", "?someValuesFrom").
		match("?someValuesFrom", "owl:unionOf", "?unionOf").
		match("?superClass", "owl:onProperty", "?property").
		match($this, "sh:property", "?propertyShape").
		match("?propertyShape", "sh:path", "?property").
		filter(function(sol) { return sol.superClass.isBlankNode() && sol.someValuesFrom.isBlankNode() } ).
		forEach(function(sol) {
			var oldArray = new RDFQueryUtil($data).rdfListToArray(sol.unionOf);
			var orList = createShapeList(oldArray, 0, results, function(node) {
				return T("<http://datashapes.org/dash#hasValueWithClass>")
			});
			results.push([sol.propertyShape, T("sh:or"), orList]);
			results.push([sol.superClass, T("<http://datashapes.org/owl2shacl#mappedTo>"), T("true")]);
		});
	return results;
}


function createShapeList(array, index, results, fun) {
	if(index >= array.length) {
		return T("rdf:nil");
	}
	else {
		var shape = TermFactory.blankNode();
		var node = TermFactory.blankNode();
		var rest = createShapeList(array, index + 1, results, fun);
		var predicate = fun(array[index]);
		results.push([shape, predicate, array[index]]);
		results.push([node, T("rdf:rest"), rest]);
		results.push([node, T("rdf:first"), shape]);
		return node;
	}
}


function isRDFSDatatype(node) {
	return $data.query().
		match(node, "rdf:type", "rdfs:Datatype").
		hasSolution();
}
