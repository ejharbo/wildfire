/*globals console, window, document */
(function ($) {
    'use strict';

    $(document).ready(function () {

        var $searchWindow = $('#searchWindow, #ontologyappSearchWindow, .swa-search-form'),
            searchFormSelector = '.swa-form.search-mode.swa-form-search';

        $searchWindow.on('keypress', searchFormSelector, function (event) {

            if (event.keyCode === 13) {
              
                event.preventDefault();

                var formId = $(searchFormSelector).attr('id'),
                    $submitBtn = $('#' + formId + '-search-button');

                $submitBtn.click();

                return false;
            }
        });

    });

}(jQuery));
