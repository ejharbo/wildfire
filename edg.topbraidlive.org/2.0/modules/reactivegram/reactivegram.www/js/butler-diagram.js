//---------------------------------------------
//JavaScript file for Butler Diagrams
//file: butler-diagrams.js
//----------------------------------------------

var butler = {
  crumbs: [],
  isInValidateMode: false,
  isInShowEmptyNodesMode: false,
  MutationObserver: window.MutationObserver || window.WebKitMutationObserver,
  //Instance Diagram support
  nextPredicateURI: null,
  nextSubjectURI: null,
  onlyShowInvalids: {},

  /**
   * used to add a resource in the butler.
   */
  addResource: function(resourceURI, subjectURI, predicateURI) {
    let params = {
      _base: swa.queryGraphURI,
      subject: '<' + subjectURI + '>',
      predicate: '<' + predicateURI + '>',
      object: resourceURI
    };

    swa.post('edg.refin:addInstanceToResource', params).then(
      function(response) {
        let params = {
          _base: '<' + swa.queryGraphURI + '>',
          focusNode: '<' + subjectURI + '>',
          isInValidateModeSetting: butler.isInValidateMode
        };

        swa.load(
          'butler-diagram',
          params,
          function(crumbs) {
            if (crumbs && crumbs.length > 0) {
              let crumb,
                newLeaf = '';

              for (let c in crumbs) {
                crumb = crumbs[c];
                newLeaf += crumb;
              }

              $('#reactive-breadcrumbs').html(newLeaf);
            }

            butler.crumbs = crumbs;

            butler.nextPredicateURI = null;
            butler.nextSubjectURI = null;
          }.bind(null, butler.crumbs)
        );
      }.bind(this)
    );
  },

  breadCrumbClick: function(fNode) {
    let crumbs = butler.crumbs;
    let newCrumbs = [];
    let rootNode = null;

    for (let i = 0; i < crumbs.length; i++) {
      if ($(fNode).text() != $(crumbs[i]).text()) {
        if ($(crumbs[i]).html() != undefined) {
          newCrumbs.push(crumbs[i]);
        }
      } else {
        if (i === 0) {
          rootNode = $(crumbs[0]);
        }
        break;
      }
    }

    newCrumbs.pop();
    butler.crumbs = newCrumbs;
    butler.handleInstanceClick(
      'butler-diagram',
      $(fNode).attr('data-attr'),
      rootNode,
      $(fNode).text()
    );
  },

  createEmptyModalDialog: function(modalId) {
    let dialogId = modalId || 'globalModalDialog';

    let returnString =
      '<div class="modal fade" tabindex="-1" role="dialog" id="' +
      dialogId +
      ' ">' +
      '<div class="modal-dialog modal-lg" role="document">' +
      '<div class="modal-content">' +
      '<div class="modal-header">' +
      '<button type="button" class="btn btn-default btn-sm close" data-dismiss="modal" aria-label="Close">' +
      '<span aria-hidden="true">&times;</span>' +
      '</button>' +
      '<h4 class="modal-title"><strong></strong></h4>' +
      '</div>' +
      '<div class="modal-body">' +
      '<div class="cp-preloader cp-preloader_absolute">' +
      '<div class="cp-preloader__ball" />' +
      '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
      '<button type="button" class="btn btn-default btn-primary btn-sm" data-dismiss="modal">Ok</button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>';

    return $(returnString);
  },

  focusOnInstance: function(id) {
    var $el = $('[id="' + id + '"]');

    var uri = $el.attr('data-instance');
    var label = $el.attr('data-label');

    butler.handleInstanceClick('butler-diagram', uri, null, label);
  },

  getDialogBodyFromServer: function(bodyClass, projectGraph, extParams) {
    let params,
      defaultParams = {
        _snippet: true,
        _viewClass: bodyClass
      };

    if (extParams) {
      params = _.assign(defaultParams, extParams);
    } else {
      params = defaultParams;
    }

    if (projectGraph) {
      params.projectGraph = projectGraph;
    }

    return $.ajax({
      url: swa.servlet,
      method: 'get',
      data: params
    });
  },

  getFilterValue: function(id) {
    return $('#' + id + '-filter').val();
  },

  handleAddResourceChange: function(e, subject, predicate) {
    if (e && e.target && e.target.value) {
      butler.addResource(e.target.value, subject, predicate);
    }
  },

  handleEditClick: function(id) {
    var $el = $('[id="' + id + '"]');
    var uri = $el.attr('data-instance');
    butler.navigateToResource(uri);
  },

  handleFilterClick: function(id) {
    var filter = butler.getFilterValue(id);

    var params = {
      _base: '<' + swa.queryGraphURI + '>',
      startIndex: 0,
      myOnlyShowInvalidInstances: butler.onlyShowInvalids[id] || false
    };
    if (filter) {
      params.filter = '"' + filter + '"';
    }
    swa.load(id, params);
  },

  handleInstanceClick: function(id, instance, rootNode, instanceLabel) {
    if (!instance) {
      swa.populateErrorModal(
        'This action cannot be performed due to a missing requirement (no resource).',
        'No Resource',
        null
      );
      return;
    }

    let crumbs = butler.crumbs;

    if (crumbs.length == 0) {
      let current = rootNode ? rootNode : $('#reactive-breadcrumbs');
      crumbs.push(
        '<span data-attr="' +
          $(current).attr('data-attr') +
          '" onclick="butler.breadCrumbClick(this)">' +
          $(current).text() +
          '</span>'
      );
    }

    var params = {
      _base: '<' + swa.queryGraphURI + '>',
      focusNode: '<' + instance + '>'
    };

    params.isInValidateModeSetting = butler.isInValidateMode;

    swa.load(
      id,
      params,
      function(crumbs) {
        if (!rootNode) {
          crumbs.push('<span> > </span>');
          crumbs.push(
            '<span data-attr="' +
              instance +
              '" onclick="butler.breadCrumbClick(this)">' +
              instanceLabel +
              '</span>'
          );
        }

        let newLeaf = '';
        crumbs.forEach(function(elem) {
          newLeaf += elem;
        });

        butler.crumbs = crumbs;
        $('#reactive-breadcrumbs').html(newLeaf);
      }.bind(null, crumbs)
    );
  },

  handlePaginationClick: function(id, startIndex) {
    var params = {
      _base: '<' + swa.queryGraphURI + '>',
      startIndex: startIndex,
      myOnlyShowInvalidInstances: butler.onlyShowInvalids[id] || false
    };

    var filter = butler.getFilterValue(id);

    if (filter) {
      params.filter = '"' + filter + '"';
    }

    swa.load(id, params);
  },

  handleShowOKnodesButtonClick: function() {
    let showOknodesButton = $('#show-ok-nodes-toggler');
    let showOknodea = showOknodesButton.attr('data-showoknodes');

    if (showOknodea == 'true') {
      showOknodesButton.attr('data-showoknodes', 'false');
      $('#show-ok-nodes-toggler span').text('Hide Valid Nodes');
    } else {
      showOknodesButton.attr('data-showoknodes', 'true');
      $('#show-ok-nodes-toggler  span').text('Show Valid Nodes');
    }
  },

  handleShowEmptyNodesButtonClick: function() {
        debugger ;
    let showEmptyNodesButton = $('#show-empty-nodes-toggler');
    let showEmptyNodesAttr = showEmptyNodesButton.attr('data-showemptynodes');

    if (showEmptyNodesAttr == 'true') {
      showEmptyNodesButton.attr('data-showemptynodes', 'false');
      $('#show-empty-nodes-toggler span').text('Show Empty Nodes');
    } else {
      showEmptyNodesButton.attr('data-showemptynodes', 'true');
      $('#show-empty-nodes-toggler  span').text('Hide Empty Nodes');
    } ;

    butler.isInShowEmptyNodesMode = ( showEmptyNodesAttr == 'false') ? true : false ;

    var params = { isInValidateModeSetting: butler.isInValidateMode , isInShowEmptyNodesMode: butler.isInShowEmptyNodesMode };
    swa.load('butler-diagram', params);
  },

  handleValidateModeClick: function() {
    let validateButton = $('#validation-toggler');
    let inValidateMode = validateButton.attr('data-invalidatemode');

    if (inValidateMode == 'true') {
      validateButton.attr('data-invalidatemode', 'false');
      validateButton.removeClass('butler-validation-on');
      validateButton.addClass('butler-validation-off');
      $('#validation-toggler  span').text('Validate Off');
    } else {
      validateButton.attr('data-invalidatemode', 'true');
      validateButton.removeClass('butler-validation-off');
      validateButton.addClass('butler-validation-on');
      $('#validation-toggler  span').text('Validate On');
    }

    butler.isInValidateMode = inValidateMode == 'true' ? false : true;
    var params = { isInValidateModeSetting: butler.isInValidateMode };
    swa.load('butler-diagram', params);
  },

  initDiagram: function(id, attributes, associationEdges) {
    var g = new dagre.graphlib.Graph({
      multigraph: true
    });

    g.setGraph({
      rankdir: 'TB'
    });

    g.setDefaultEdgeLabel(function() {
      return {};
    });

    $('#' + id)
      .children('*[class^="swauml-instance-node"]')
      .each(function(index, e) {
        var rs = e.getClientRects();
        var width = rs[0].width;
        var height = rs[0].height;
        var iri = $(e).attr('about');
        g.setNode(iri, { width: width, height: height });
      });

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

    g.edges().forEach(function(e) {
      var edge = g.edge(e);
      var origin = edge.points[0];
      var points = '';
      var lineElement;
      $.each(edge.points, function(index, element) {
        points +=
          '' +
          (edgeOffset + edge.points[index].x) +
          ',' +
          (edgeOffset + edge.points[index].y) +
          ' ';
      });
      if (edge.predicate) {
        lineElement = $('#' + id).find('[about="' + e.v + ' ' + e.w + ' ' + edge.predicate + '"]');
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
  },

  initFilter: function(id) {
    let el = $('#' + id + '-filter');

    if (el && el.length) {
      el.on('keydown', function(e) {
        if (e.keyCode == 13) {
          e.preventDefault();
          butler.handleFilterClick(id);
        }
      });
    }
  },

  navigateToResource: function(resource) {
    if (!resource) {
      swa.populateErrorModal(
        'This action cannot be performed due to a missing requirement (no resource).',
        'No Resource',
        null
      );
      return;
    }
    window.location =
      swa.server +
      swa.servlet +
      '?_base=' +
      escape(swa.queryGraphURI) +
      '&_viewClass=teamwork:SimpleFormEditorApplication' +
      '&resource=' +
      escape(resource);
  },

  /**
   * used to implement on-the-fly creation of instances.
   */
  openCreateResourceDialog: function(typeURI, predicateURI, resourceURI) {
    var loadId = 'myCreateResourceDialog' + swa.getRunningIndex();
    var params = {
      callback: 'butler.openCreateResourceDialogHelper',
      loadId: '"' + loadId + '"',
      resourceType: '<' + typeURI + '>',
      _base: '<' + swa.queryGraphURI + '>'
    };

    if (swa.swaAppName) {
      params['_contextswaAppName'] = '"' + swa.swaAppName + '"';
    }

    butler.nextSubjectURI = resourceURI;
    butler.nextPredicateURI = predicateURI;

    swa.loadModalDialog('swa:CreateResourceDialog', loadId, params, 675, 205);
  },

  /**
   * Called when the dialog opened by a CreateResourceButton is OKed.
   *
   * @param typeURI
   *            the URI of the class to instantiate
   * @param resourceURI
   *            the URI of the resource to create
   * @param label
   *            the label of the new resource
   * @param labelLang
   *            the (optional) language of the label
   * @param contextResourceURI
   *            an optional URI such as superclass, passed to the web service
   * @param handlerURI
   *            the URI of the create handler (SWP view class) to call on
   *            completion
   * @param resourceSelectedEvent
   *            the name of an optional event to publish the new URI under when
   *            done
   * @param contextHolderId
   *            placeholder unused
   * @param classSelectedEvent
   *            placeholder unused
   * @param loadId
   *            used as a key to find a form within the dialog
   */

  openCreateResourceDialogHelper: function(
    typeURI,
    resourceURI,
    label,
    labelLang,
    contextResourceURI,
    handlerURI,
    resourceSelectedEvent,
    contextHolderId,
    classSelectedEvent,
    loadId
  ) {
    // ok button click calls this
    let formExtras = {};
    let form = document.getElementById('form-' + loadId);

    if (form) {
      let modalConfig = form.querySelector('[data-handler]');

      if (modalConfig) {
        // only set this value from the form if the existing value is null
        if (handlerURI == null || handlerURI == '') {
          handlerURI = modalConfig.getAttribute('data-handler');
        }
      }

      let property,
        value,
        inputs = Array.from(form.querySelectorAll('[data-property]'));

      inputs.forEach(function(input) {
        property = input.getAttribute('data-property');
        value = input.value;

        formExtras[property] = value;
      });
    }

    swa.createResourceHelper(
      typeURI,
      resourceURI,
      label,
      labelLang,
      contextResourceURI,
      handlerURI != null && handlerURI != '' ? handlerURI : 'swa:CreateResourceHandler',
      resourceSelectedEvent,
      formExtras,
      function(resourceURI) {
        let params = {
          _base: swa.queryGraphURI,
          subject: '<' + butler.nextSubjectURI + '>',
          predicate: '<' + butler.nextPredicateURI + '>',
          object: '<' + resourceURI + '>'
        };

        swa.post('edg.refin:addInstanceToResource', params).then(
          function(response) {
            let params = {
              _base: '<' + swa.queryGraphURI + '>',
              focusNode: '<' + butler.nextSubjectURI + '>',
              isInValidateModeSetting: butler.isInValidateMode
            };

            swa.load(
              'butler-diagram',
              params,
              function(crumbs) {
                if (crumbs && crumbs.length > 0) {
                  let crumb,
                    newLeaf = '';

                  for (let c in crumbs) {
                    crumb = crumbs[c];
                    newLeaf += crumb;
                  }

                  $('#reactive-breadcrumbs').html(newLeaf);
                }

                butler.crumbs = crumbs;

                butler.nextPredicateURI = null;
                butler.nextSubjectURI = null;
              }.bind(null, butler.crumbs)
            );
          }.bind(this)
        );
      }
    );
  },

  /**
   * Populates and launches a bootstrap modal dialog that uses a callback to get
   * body content
   *
   * @param bodyClass
   *            {String} the SWP class that contains the body HTML.
   * @param title
   *            {String} the heading/title of the modal dialog
   * @param onLoad
   *            {function} the js code to be fired after the modal dialog has been
   *            rendered to the screen
   * @param projectGraph -
   *            the graph tha provides the context for the modal
   * @param resource -
   *            the resource in focus
   * @returns the dialog markup
   */

  populateModalDialogAskingForBody: function(bodyClass, title, onLoad, projectGraph, resource) {
    return butler.populateModalDialogFromServer(bodyClass, title, onLoad, projectGraph, {
      resource: resource
    });
  },

  populateModalDialogFromServer: function(
    bodyClass,
    title,
    onLoad,
    projectGraph,
    extParams,
    modalId
  ) {
    return new Promise(function(resolve, reject) {
      var $modalContainer = butler.createEmptyModalDialog(modalId);

      let jqXHR = butler.getDialogBodyFromServer(bodyClass, projectGraph, extParams);

      Promise.resolve(jqXHR).then(
        function(data) {
          $modalContainer.find('.modal-body').html(data);
        },
        function(err) {
          console.log(err);
          reject(err);
        }
      );

      if (title) {
        $modalContainer.find('.modal-title strong').html(title);
      }

      if (close) {
        $modalContainer.find('.modal-footer button').html('Close');
      }

      $modalContainer.on('shown.bs.modal', function() {
        document.activeElement.blur();
      });

      $modalContainer.modal('show').on('shown.bs.modal', function() {
        // once the modalContainer is shown, fire the onLoad event
        // to run afterwards
        if (onLoad != null && onLoad.constructor && onLoad.call && onLoad.apply) {
          onLoad();
        }
      });

      $modalContainer.find('.modal-content').draggable({
        handle: '.modal-header',
        containment: 'document'
      });

      // If the modal is closed in any way, resolve the promise
      $modalContainer.on('hidden.bs.modal', function(e) {
        let $modalBody = $modalContainer.find('.modal-body');
        $modalContainer.remove();
        return resolve();
      });
    });
  },

  /**
   * Populates and launches a bootstrap modal dialog that uses a callback to
   * get body content
   *
   * @param bodyClass
   *            {String} the SWP class that contains the body HTML.
   * @param title
   *            {String} the heading/title of the modal dialog
   * @param onLoad
   *            {function} the js code to be fired after the modal dialog has
   *            been rendered to the screen
   * @param projectGraph -
   *            the graph tha provides the context for the modal
   * @param resource -
   *            the resource in focus
   * @param parameters -
   *            a JSON object for passing addition parameters
   * @returns the dialog markup
   */

  populateModalDialogWithCallbackForBody: function(
    bodyClass,
    title,
    onLoad,
    projectGraph,
    resource,
    parameters
  ) {
    var mergedParameters = _.assign({}, { resource: resource }, parameters);
    return butler.populateModalDialogFromServer(
      bodyClass,
      title,
      onLoad,
      projectGraph,
      mergedParameters
    );
  },

  /**
   * used to remove a statement in the butler.
   */
  removeStatement: function(subjectURI, predicateURI, id) {
    var $el = $('[id="' + id + '"]');
    var resourceURI = $el.attr('data-instance');

    let params = {
      _base: swa.queryGraphURI,
      subject: '<' + subjectURI + '>',
      predicate: '<' + predicateURI + '>',
      object: '<' + resourceURI + '>'
    };
    swa.post('edg.refin:removeStatement', params).then(
      function(response) {
        let params = {
          _base: '<' + swa.queryGraphURI + '>',
          focusNode: '<' + subjectURI + '>',
          isInValidateModeSetting: butler.isInValidateMode
        };
        swa.load(
          'butler-diagram',
          params,
          function(crumbs) {
            butler.crumbs = crumbs;
          }.bind(null, butler.crumbs)
        );
      }.bind(this)
    );
  },

  revalidateInstance: function(uri, label) {
    butler.isInValidateMode = true;
    butler.handleInstanceClick('butler-diagram', uri, null, label);
  },

  showInvalidValues: function(checkbox) {
    let checked = checkbox.checked;
    // trigger filter reload - use id of the checkbox to construct loadable
    // id, removing INVCB_
    let id = checkbox.id.replace('INVCB_', '');
    butler.onlyShowInvalids[id] = checked;
    butler.handleFilterClick(id);
  },

  trackChange: function(element) {
    var observer = new butler.MutationObserver(function(mutations, observer) {
      if (mutations[0].attributeName == 'value') {
        $(element).trigger('change');
      }
    });

    observer.observe(element, {
      attributes: true
    });
  }
};
