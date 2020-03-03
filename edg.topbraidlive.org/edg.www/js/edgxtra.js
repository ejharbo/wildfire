// JavaScript file for TopBraid EDG extra JS
// file: edgxtra.js

var edgxtra = {

//
// Property Value Selector - Graph Changed
//
  pvsGraphKnown : function(data) {
	  var server = escape(swa.server) ,
	      classDivId = data.classDivId ,
	      propertyDivId = data.propertyDivId ,
          params =  {
					_snippet : true,
					_viewClass : 'edg:PVSclassSelector',
					graph : data.graph,
                    resource : data.resource ,
                    projectGraph: data.projectGraph ,
                    loadId : propertyDivId
			        };

      var $jqXHR = $.ajax({
    		        'url': swa.servlet,
    		        'method': 'get',
    		        'data': params
    		       });

    		    $.when(
    		    	$jqXHR
    		    ).done(function (data, textStatus, jqXHR) {
                    $('#' + classDivId ).empty().append(data);
                    $('#' + propertyDivId ).empty();
    		    }).fail(function (jqXHR, textStatus, errorThrown) {
    		    	console.log('Failed') ;
    	            swa.populateModalDialog('PVS class selection failed: ' + errorThrown, 'PVS class selection failed', null);
    		    });

    } ,

//
// Property Value Selector - Class Changed
//
      pvsClassKnown : function(data) {
    	  var server = escape(swa.server) ,

    	      propertyDivId = data.propertyDivId ,
              params =  {
    					_snippet : true,
    					_viewClass : 'edg:PVSpropertySelector',
    					graph : data.graph,
    					resource : data.resource,
                        class : data.class
    			        };

          var $jqXHR = $.ajax({
        		        'url': swa.servlet,
        		        'method': 'get',
        		        'data': params
        		       });

        		    $.when(
        		    	$jqXHR
        		    ).done(function (data, textStatus, jqXHR) {
                        $('#' + propertyDivId ).empty().append(data);
        		    }).fail(function (jqXHR, textStatus, errorThrown) {
        		    	console.log('Failed') ;
        	            swa.populateModalDialog('PVS property selection failed: ' + errorThrown, 'PVS property selection failed', null);
        		    });

        },

// =====
// Flows
// =====

// Flow source changed
//
          flowSource : function(data) {
//               console.log('flow source: ') ;
//               console.log(data) ;
        	  var server = escape(swa.server) ,
        	      sourceDivId = data.sourceDivId ,
        	      targetDivId = data.targetDivId ,
        	      identifierDivId = data.identifierDivId ,
                  params =  {
        					_snippet : true,
        					_viewClass : 'edg:FlowTargetSelector',
        					graph : data.graph,
                            source : data.source ,
                            resourceType: data.resourceType ,
                            projectGraph: data.projectGraph ,
                            loadId : data.identifierDivId
        			        };

              if(sourceDivId){
                $('#' + sourceDivId).attr('data-property','source');
              }


              var $jqXHR = $.ajax({
            		        'url': swa.servlet,
            		        'method': 'get',
            		        'data': params
            		       });

            		    $.when(
            		    	$jqXHR
            		    ).done(function (data, textStatus, jqXHR) {
                            $('#' + targetDivId ).empty().append(data) ,
                            $('#' + identifierDivId ).empty()
            		    }).fail(function (jqXHR, textStatus, errorThrown) {
            		    	console.log('Failed') ;
            	            swa.populateModalDialog('Flow target failed: ' + errorThrown, 'Flow target failed', null);
            		    });

            } ,

//
// Flow target changed
//
          flowTarget : function(data) {
//          	      console.log('flow target delivered: ') ;
//         	      console.log(data) ;
               	  var server = escape(swa.server) ,
               	      sourceDivId = data.sourceDivId ,
               	      targetDivId = data.targetDivId ,
               	      identifierDivId = data.identifierDivId ,
                      params =  {
               					_snippet : true,
               					_viewClass : 'edg:FlowIdentifierSetter',
               					graph : data.graph,
                                source : data.source ,
                                target : data.target ,
                                resourceType: data.resourceType ,
                                projectGraph: data.projectGraph ,
                                loadId : data.identifierDivId
               			        };

                    if(targetDivId){
                      $('#' + targetDivId).attr('data-property','target');
                    }

                     var $jqXHR = $.ajax({
                   		        'url': swa.servlet,
                   		        'method': 'get',
                   		        'data': params
                   		       });

                   		    $.when(
                   		    	$jqXHR
                   		    ).done(function (data, textStatus, jqXHR) {
                                   $('#' + identifierDivId ).empty().append(data)
                   		    }).fail(function (jqXHR, textStatus, errorThrown) {
                   		    	console.log('Failed') ;
                   	            swa.populateModalDialog('Flow identifier generation failed: ' + errorThrown, 'Flow identifier failed', null);
                   		    });

                   },

// =================
// Logical Relations
// =================
//
// Source Entity changed
//
    relationSource : function(data) {
//               console.log('relation source: ') ;
//               console.log(data) ;
        	  var server = escape(swa.server) ,
        	      sourceDivId = data.sourceDivId ,
        	      targetDivId = data.targetDivId ,
        	      identifierDivId = data.identifierDivId ,
                  params =  {
        					_snippet : true,
        					_viewClass : 'edg:LogicalRelationTargetSelector',
        					graph : data.graph,
                            source : data.source ,
                            resourceType: data.resourceType ,
                            projectGraph: data.projectGraph ,
                            loadId : data.identifierDivId
        			        };

              if(sourceDivId){
                $('#' + sourceDivId).attr('data-property','source');
              }


              var $jqXHR = $.ajax({
            		        'url': swa.servlet,
            		        'method': 'get',
            		        'data': params
            		       });

            		    $.when(
            		    	$jqXHR
            		    ).done(function (data, textStatus, jqXHR) {
                            $('#' + targetDivId ).empty().append(data) ,
                            $('#' + identifierDivId ).empty()
            		    }).fail(function (jqXHR, textStatus, errorThrown) {
            		    	console.log('Failed') ;
            	            swa.populateModalDialog('Relation target failed: ' + errorThrown, 'Relation target failed', null);
            		    });

            } ,

//
// Target Entity changed
//
         relationTarget : function(data) {
//         	      console.log('Relation target: ') ;
//         	      console.log(data) ;
               	  var server = escape(swa.server) ,
               	      sourceDivId = data.sourceDivId ,
               	      targetDivId = data.targetDivId ,
               	      identifierDivId = data.identifierDivId ,
               	      source = (data.source)? data.source : $('#'+ sourceDivId )[0].value ,
                      params =  {
               					_snippet : true,
               					_viewClass : 'edg:LogicalRelationIdentifierSetter',
               					graph : data.graph,
                                source : source ,
                                target : data.target ,
                                resourceType: data.resourceType ,
                                projectGraph: data.projectGraph ,
                                loadId : data.identifierDivId
               			        };


                    if(targetDivId){
                      $('#' + targetDivId).attr('data-property','target');
                    }

                     var $jqXHR = $.ajax({
                   		        'url': swa.servlet,
                   		        'method': 'get',
                   		        'data': params
                   		       });

                   		    $.when(
                   		    	$jqXHR
                   		    ).done(function (data, textStatus, jqXHR) {
                                   $('#' + identifierDivId ).empty().append(data)
                   		    }).fail(function (jqXHR, textStatus, errorThrown) {
                   		    	console.log('Failed') ;
                   	            swa.populateModalDialog('Logical Relation identifier generation failed: ' + errorThrown, 'Logical Relation identifier failed', null);
                   		    });

                   },

// Attribute's Entity changed
//
    attributeOf : function(data) {
//               console.log('Attribute of: ') ;
//               console.log(data) ;
        	  var entityDivId = data.entityDivId ;

              if(entityDivId){
                $('#' + entityDivId).attr('data-property','logicalEntity');
              }
            } ,

// Checkbox changed
//
    checkbox : function(data) {
        	  var checkboxId = data.checkboxId ;
              if( $('#' + checkboxId).is(":checked") == true){
                $('#' + checkboxId).attr('value', true);
              } else {
               $('#' + checkboxId).attr('value', false);
              }
         }

}
