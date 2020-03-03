// JavaScript file for TopBraid Accordian-managed EDG Batch Jobs
// file: edg-accordianForBatchJobs.js

var edgAccordianForBatchJobs = {

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
			   $('#accordianForBatchJobs-log').empty() ;
		   },

// Start again
//
		   cancel: function() {
			   $('#accordianForBatchJobs-jobs').empty() ;
			   $('#accordianForBatchJobs-log').empty() ;
			   $('#accordianForBatchJobs' ).accordion("option", "active", 0);
		   },

		   selectAll: function(tableId) {
			   $("#" + tableId).find('input[type="checkbox"]').prop('checked', true);
		   },

// Accept selected rows and move to the confirm dialog
//

		   acceptSelection: function(callBack, projectGraph,tableId) {
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
					graph : projectGraph,
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
			    	$('#accordianForBatchJobs-jobs').empty().append(data);
			    }).fail(function (jqXHR, textStatus, errorThrown) {
			    	console.log('Failed') ;
		            swa.populateModalDialog('Operation failed: ' + errorThrown, 'Operation failed', null);
			    });

				$( "#accordianForBatchJobs" ).accordion("option", "active", 1);
		   },

// Perform batch import tasks
//
		    executeBatchJobs: function(callBack, tableId, projectGraph) {

			    var progressId = 'swa-progress-' + Math.random(),
                    checkedReplaceBoxes = $("#" + tableId).find(":checked") ,
			        uncheckedRows =  $("#" + tableId).find("input:checkbox:not(:checked)") ,
		            jsonReplaceData = [] ,
		            jsonAugmentData = [] ;

    		    $.each(checkedReplaceBoxes, function () {
    			    var resource = $(this).attr('data-uri');

    			    jsonReplaceData.push({
                        resource : resource
                    });
                });

    		    $.each(uncheckedRows, function () {
    			    var resource = $(this).attr('data-uri');

    			    jsonAugmentData.push({
                        resource : resource
                    });
                });

    		    var params = {
    				_snippet : true,
    				_viewClass : callBack,
                    _progressId : progressId,
    				sourceAugmentGraphs : JSON.stringify(jsonAugmentData) ,
    				sourceReplaceGraphs : JSON.stringify(jsonReplaceData) ,
    				targetGraph : projectGraph,
    				_contextdebug: false
    		    };

                swa.openProgressMonitorDialog(progressId, 'Importing Enumerations');

    			var $jqXHR = $.ajax({
    		        'url': swa.servlet,
    		        'method': 'get',
    		        'data': params
    		    });

    		    $.when(
    		    	$jqXHR
    		    ).done(function (data, textStatus, jqXHR) {
                    swa.closeProgressMonitorDialog();
    		    	$('#accordianForBatchJobs-log').empty().append(data);
    		    }).fail(function (jqXHR, textStatus, errorThrown) {
    		    	console.log('Failed') ;
    	            swa.populateModalDialog('Import failed: ' + errorThrown, 'Import failed', null);
    		    });

    			$( "#accordianForBatchJobs" ).accordion("option", "active", 2);
    	   } ,

// Empty all accordian panels
//
    	   initialize: function(data,projectGraph) {
    			$('#panel-body').empty() ;
    			$('#accordianForBatchJobs-jobs').empty() ;
    			$('#accordianForBatchJobs-log').empty() ;
    			$("#accordianForBatchJobs" ).accordion("option", "active", 0)
    	   } ,


//		   executeTask: function(taskDetails,projectGraph) {
//				var params = {
//			      _snippet : true,
//			      _viewClass :  'edg:ExecuteJob',
//			      graph : projectGraph
//			    };
//
//				var $jqXHR = $.ajax({
//			        'url': swa.servlet,
//			        'method': 'get',
//			        'data': params
//			    });
//
//			    $.when(
//			    	$jqXHR
//			    ).done(function (data, textStatus, jqXHR) {
//					$('#accordianForBatchJobs-canvas').empty().append(data);
//			    }).fail(function (jqXHR, textStatus, errorThrown) {
//		            swa.populateModalDialog('Operation failed: ' + errorThrown, 'Operation failed', null);
//			    });
//
//			    return $jqXHR;
//		   }

/**
 *  cancel an import
 */
    cancelImport : function(tabPageTarget,projectGraph) {
      var server = escape(swa.server) ;
      document.location.href =  server + 'swp?_viewClass=' + tabPageTarget + '&projectGraph=' + projectGraph ;
    } ,

/**
 *  execute an import
 */
    executeImport : function(tabPageTarget,projectGraph,importService,importId) {
      var server = escape(swa.server) ,
          params = {
					_snippet : true,
					_viewClass : importService,
					projectGraph : projectGraph,
                    importId : importId
			   };
      
      var $jqXHR = $.ajax({
    		        'url': swa.servlet,
    		        'method': 'get',
    		        'data': params
    		    });

    		    $.when(
    		    	$jqXHR
    		    ).done(function (data, textStatus, jqXHR) {
//    		    	$('#accordianForBatchJobs-log').empty().append(data);
//    		    	$( "#accordianForBatchJobs" ).accordion("option", "active", 1);
                    document.location.href =  server + 'swp?_viewClass=' + tabPageTarget 
                                                     + '&projectGraph=' + projectGraph ;
    		    }).fail(function (jqXHR, textStatus, errorThrown) {
    		    	console.log('Failed') ;
    	            swa.populateModalDialog('Import failed: ' + errorThrown, 'Import failed', null);
    		    });

    }

};


(function ($) {

	$(document).ready(function () {


		var isAccordianForBatchJobsPage = $('[data-page-type*="accordian-for-batch-jobs"]').length > 0;


		if (isAccordianForBatchJobsPage) {
			var $selectMenu = $('.chosen-select');

			$('.chosen-select').chosen({
			    disable_search_threshold: 8,
			    no_results_text: "No results found for"
			});

			if ($selectMenu.val() !== null) {

//				var projectGraph = $('.chosen-select').attr('data-project-graph');
//
//				var $jqXHR = edgAccordianForBatchJobs.initialize($selectMenu.val(), projectGraph);
//
//				$.when($jqXHR)
//				.done(function () {
					$('#accordianForBatchJobs').accordion({
						"collapsible": true,
						"icons": false
					});
//				});
			}

//			$selectMenu.on('change', function () {
//
//				var $selectMenu = $(this),
//					projectGraph = $selectMenu.attr('data-project-graph');
//
//				$('#accordianForBatchJobs-canvas').empty();
//
//				var $jqXHR = edgAccordianForBatchJobs.initialize($selectMenu.val(), projectGraph);
//
//				$.when(
//					$jqXHR
//				)
//				.done(function () {
//					$('#accordianForBatchJobs').accordion({
//						"collapsible": true,
//						"icons": false
//					});
//				});
//			});
		}



	});


}(jQuery));



