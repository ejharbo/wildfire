// JavaScript file for TopBraid Accordian-managed EDG Batch Jobs
// file: edg-accordionFor.js

var edgAccordion = {

		load: function(pane) {

			var params = {
				_snippet : true,
				_viewClass :  pane,
				_contextdebug: true
			};

			var $jqXHR = $.ajax({
		        'url': swa.servlet,
		        'method': 'get',
		        'data': params
		    });

		    $.when(
		    	$jqXHR
		    ).done(function (data, textStatus, jqXHR) {
			    swa.load('edg-importer-main-canvas', data);
		    }).fail(function (jqXHR, textStatus, errorThrown) {
	            swa.populateModalDialog('Operation failed: ' + errorThrown, 'Operation failed', null);
		    });

		    return $jqXHR;
		},

// Uncheck the select checkboxes
//
		   clearSelection: function(tableId) {
			   $("#" + tableId).find('input[type="checkbox"]').prop('checked', false);
			   $('#accordion-job2').empty() ;
		   },

// Start again
//
		   cancel: function() {
		       console.log('Cancelled');
			   $('#accordion-job1').empty() ;
			   $('#accordion-job2').empty() ;
			   $('#accordion-container' ).accordion("option", "active", 0);
		   },

		   selectAll: function(tableId) {
			   $("#" + tableId).find('input[type="checkbox"]').prop('checked', true);
		   },

/**
* acceptSelection
* Accept selected rows and move to the confirm dialog
*/

		   acceptSelection: function(callBack, subjectArea, tableId) {
			   var checkedBoxes = $("#" + tableId).find(":checked") // $(".swa-relevant-properties").find(':checked'),
			       jsonData = [] ;

			   $.each(checkedBoxes, function () {
				   var resource = $(this).attr('data-uri');

                    jsonData.push({
                        resource: resource
                    });
               });

			   var params = {
					_snippet : true,
					_viewClass : callBack,
					resources : JSON.stringify(jsonData),
					subjectArea: subjectArea,
					_contextdebug: false
			   };

				var $jqXHR = $.ajax({
			        'url': swa.servlet,
			        'method': 'get',
			        'data': params
			    });

			    $.when(
			    	$jqXHR
			    ).done(function (data, textStatus, jqXHR) {
			    	$('#accordion-job1').empty().append(data);
			    }).fail(function (jqXHR, textStatus, errorThrown) {
			    	console.log('Failed') ;
		            swa.populateModalDialog('Operation failed: ' + errorThrown, 'Operation failed', null);
			    });

				$( "#accordion-container" ).accordion("option", "active", 1);
		   },

/**
* executeJob1
* 
*/
		    executeJob1: function(callBack, resources, subjectArea) {

    		    var params = {
    				_snippet : true,
    				_viewClass : callBack,
    				resources : JSON.stringify(resources) ,
    				subjectArea: subjectArea,
    				_contextdebug: false
    		    };

    			var $jqXHR = $.ajax({
    		        'url': swa.servlet,
    		        'method': 'get',
    		        'data': params
    		    });

    		    $.when(
    		    	$jqXHR
    		    ).done(function (data, textStatus, jqXHR) {
    		    	$('#accordion-job2').empty().append(data);
    		    }).fail(function (jqXHR, textStatus, errorThrown) {
    		    	console.log('Failed') ;
    	            swa.populateModalDialog('Error: ' + errorThrown, 'Job failed', null);
    		    });

    			$( "#accordion-container" ).accordion("option", "active", 2);
    	   } ,

/** initialize
* Empty all accordion panels
*/
    	   initialize: function(data,projectGraph) {
    			$('#panel-body').empty() ;
    			$('#accordion-job1').empty() ;
    			$('#accordion-job2').empty() ;
    			$("#accordion-container" ).accordion("option", "active", 0)
    	   } 
};


(function ($) {

	$(document).ready(function () {
	
		var isAccordionPage = $('[data-page-type*="accordion"]').length > 0;

		if (isAccordionPage) {
			var $selectMenu = $('.chosen-select');

			$('.chosen-select').chosen({
			    disable_search_threshold: 8,
			    no_results_text: "No results found for"
			});

             
		if ($selectMenu.val() !== null) {
					$('#accordion-container').accordion({
						"collapsible": true,
						"icons": false
					});
			}

		}



	});


}(jQuery));



