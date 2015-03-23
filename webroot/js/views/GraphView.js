/*
 * Copyright (c) 2014 Juniper Networks, Inc. All rights reserved.
 */

define([
    'underscore',
    'joint',
    'contrail-graph-model'
], function (_, Joint, ContrailGraphModel) {
    var GraphView = joint.dia.Paper.extend({
        constructor: function (viewConfig) {
            var graphConfig = viewConfig.graphModelConfig,
                tooltipConfig, clickEventsConfig, controlPanelConfig,
                graphControlPanelId = "#graph-control-panel",
                graphLoadingId = '#graph-loading',
                self = this;

            self.model = new ContrailGraphModel(graphConfig);
            self.viewConfig = viewConfig;

            joint.dia.Paper.apply(self, arguments);

            tooltipConfig = contrail.handleIfNull(viewConfig.tooltipConfig, []);
            clickEventsConfig = contrail.handleIfNull(viewConfig.clickEvents, {});
            controlPanelConfig = contrail.handleIfNull(viewConfig.controlPanel, false);

            self.model.beforeDataUpdate.subscribe(function() {
                $(self.el).find(".font-element").remove();
            });

            self.model.onAllRequestsComplete.subscribe(function() {
                var directedGraphSize = self.model.directedGraphSize,
                    jointObject = {
                        graph: self.model,
                        paper: self
                    };

                if(controlPanelConfig) {
                    var controlTemplate = contrail.getTemplate4Id(cowc.TMPL_GRAPH_CONTROL_PANEL);

                    var customConfig = $.extend(true, {}, controlPanelConfig.custom);

                    $.each(customConfig, function(configKey, configValue) {
                        if (contrail.checkIfFunction(configValue.iconClass)) {
                            configValue.iconClass = configValue.iconClass(jointObject);
                        }
                    });

                    $(graphControlPanelId).html(controlTemplate({
                        defaultConfig: controlPanelConfig.default,
                        customConfig: customConfig
                    }));

                    initControlPanelEvents(jointObject, graphControlPanelId, graphConfig, controlPanelConfig, graphControlPanelId)
                }

                if(contrail.checkIfFunction(viewConfig.successCallback)) {
                    $(graphLoadingId).remove();
                    viewConfig.successCallback(jointObject, directedGraphSize);
                }

                initClickEvents(clickEventsConfig, jointObject);
                initMouseEvents(tooltipConfig, jointObject)
            });

            return self;
        },

        render: function () {
            this.model.fetchData();
        },

        refreshData: function () {
            this.model.refreshData();
        }
    });

    var initControlPanelEvents = function(jointObject, graphControlPanelId, graphConfig, controlPanelConfig, graphControlPanelId) {
        var graphControlPanelElement = $(graphControlPanelId);

        if (controlPanelConfig.default.panzoom.enable == true) {
            var panzommTargetId = controlPanelConfig.default.panzoom.selectorId,
                panZoomDefaultConfig = {
                    increment: 0.3,
                    minScale: 0.3,
                    maxScale: 2,
                    duration: 300,
                    $zoomIn: graphControlPanelElement.find(".zoom-in"),
                    $zoomOut: graphControlPanelElement.find(".zoom-out"),
                    $reset: graphControlPanelElement.find(".zoom-reset")
                },
                panzoomConfig = $.extend(true, panZoomDefaultConfig, controlPanelConfig.default.panzoom.config);

            $(panzommTargetId).panzoom("reset");
            $(panzommTargetId).panzoom("resetPan");
            $(panzommTargetId).panzoom("destroy");
            $(panzommTargetId).panzoom(panzoomConfig);

        }

        $.each(controlPanelConfig.custom, function(configKey, configValue) {
            var graphControlElement = graphControlPanelElement.find('.' + configKey);

            $.each(configValue.events, function(eventKey, eventValue) {
                graphControlElement
                    .off(eventKey)
                    .on('click', eventValue(jointObject));
            });
        });

    };

    var initMouseEvents = function(tooltipConfig, jointObject) {
        var timer = null;
        $.each(tooltipConfig, function (keyConfig, valueConfig) {
            $('g.' + keyConfig).popover('destroy');
            $('g.' + keyConfig).popover({
                trigger: 'manual',
                html: true,
                animation: false,
                placement: function (context, src) {
                    $(context).addClass('popover-tooltip');

                    var srcOffset = $(src).offset(),
                        bodyWidth = $('body').width();

                    if (srcOffset.left > (bodyWidth / 2)) {
                        return 'left';
                    } else {
                        return 'right';
                    }
                },
                title: function () {
                    return valueConfig.title($(this), jointObject);
                },
                content: function () {
                    return valueConfig.content($(this), jointObject);
                },
                container: $('body')
            })
            .off("mouseenter")
            .on("mouseenter", function () {
                var _this = this;
                    clearTimeout(timer);
                    timer = setTimeout(function(){
                        $('g').popover('hide');
                        $('.popover').remove();

                        $(_this).popover("show");

                        $(".popover").find('.btn')
                            .off('click')
                            .on('click', function() {
                                var actionKey = $(this).data('action'),
                                    actionsCallback = valueConfig.actionsCallback($(_this), jointObject);

                                actionsCallback[actionKey].callback();
                                $(_this).popover('hide');
                            }
                        );

                        $(".popover").find('.popover-remove-icon')
                            .off('click')
                            .on('click', function() {
                                $(_this).popover('hide');
                                $(this).parents('.popover').remove();
                            }
                        );

                    },1000)
            })
            .off("mouseleave")
            .on("mouseleave", function () {
                clearTimeout(timer);
            });
        });
    };

    function initClickEvents(eventConfig, jointObject) {
        var timer = null,
            topContainerElement = $('#' + ctwl.TOP_CONTENT_CONTAINER);

        var onTopContainerBankDblClickHandler = function(e) {
            if(!$(e.target).closest('g').length && !$(e.target).closest('.graph-controls').length) {
                if(contrail.checkIfFunction(eventConfig['blank:pointerdblclick'])) {
                    eventConfig['blank:pointerdblclick']();
                }
            }
        };

        if(contrail.checkIfFunction(eventConfig['cell:pointerclick'])) {
            jointObject.paper.on('cell:pointerclick', function(cellView, evt, x, y) {

                if (timer) {
                    clearTimeout(timer);
                }

                timer = setTimeout(function() {
                    eventConfig['cell:pointerclick'](cellView, evt, x, y);
                    clearTimeout(timer);
                }, 500);
            });
        }

        if(contrail.checkIfFunction(eventConfig['cell:pointerdblclick'])) {
            jointObject.paper.on('cell:pointerdblclick', function(cellView, evt, x, y) {
                clearTimeout(timer);
                eventConfig['cell:pointerdblclick'](cellView, evt, x, y);
            });
        }

        $(document)
            .off('click', onDocumentClickHandler)
            .on('click', onDocumentClickHandler);

        topContainerElement
            .off('dblclick', onTopContainerBankDblClickHandler)
            .on('dblclick', onTopContainerBankDblClickHandler);
    };

    var onDocumentClickHandler = function(e) {
        if(!$(e.target).closest('.popover').length) {
            $('g').popover('hide');
        }
    };

    return GraphView;
});