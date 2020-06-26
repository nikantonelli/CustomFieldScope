Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    serverURL: "https://rally1.rallydev.com/slm/at/findOccurrences.sp",
    
    items: [
        {
            xtype: 'panel',
            id: 'resultList',
            margin: '10px',
            layout: {
                type: 'table',
                columns: 3,
                tdAttrs: {
                    style: {
                        border: 'none'
                    }
                }
            },
        }
    ],

    launch: function() {
        var me = this;
        Ext.create('Rally.data.wsapi.Store', {
            model: 'TypeDefinition',
            fetch: true,
            filters: [
                {
                    property: 'Attributes.Custom',
                    value: true
                }
            ]
        }).load().then({
            success: function(store) {
                //This gives us a list of artefacts with Custom fields on them.
                //Now we fetch the custom=true attributedefinitions from the Attributes field
                var promises = [];
                _.each(store, function(typeDef) {
                    promises.push( me._getAttributes(typeDef));
                });
                Deft.Promise.all(promises).then( {
                    success: function(resultsArray) {
                        var attributePromises = [];
                        _.each(resultsArray, function(result) {
                            _.each(result.results, function(attribute) {
                                attributePromises.push ( me._getOccurrences(attribute.get('ObjectID'), result.typeDef.get('ObjectID')));
                            }, me);
                        });
                        me.setLoading(Ext.String.format('Fetching {0} sets of occurrences', attributePromises.length));
                        Deft.Promise.all(attributePromises).then({
                            success: function(attributeResults) {
                                var allResults = [];
                                _.each(attributeResults, function(resultSet) {
                                    allResults = allResults.concat(_.filter(resultSet, function(result) {
                                        return ((result.IsProjectOpen === true) && (result.IsRecycled === false));
                                    }));
                                });
                                var sortedResults = _.groupBy(allResults, function(result) {
                                    return result.Project;
                                });
//                                me.setLoading(Ext.String.format('Fetching info for {0} projects', Object.keys(sortedResults).length));
                                me.setLoading(false);
                                var list = Ext.ComponentQuery.query('#resultList')[0];
                                list.add( { html: me._setDiv('Project Name', 'tableheader')});
                                list.add( { html: me._setDiv('Artefact Count', 'tableheader')});
                                list.add( { html: me._setDiv('Artefact List (up to 200 chars)', 'tableheader')});

                                _.each(Object.keys(sortedResults), function(key) {
                                    list.add({ html: me._setDiv(key,'definedfield') });
                                    list.add({ html: me._setDiv(sortedResults[key].length,'definedfield')});
                                    list.add({ html: me._setDiv(_.flatten(sortedResults[key], 'FormattedID').toString().slice(0,200), 'definedfield')});
                                });
                                console.log(sortedResults);
                            },
                            failure: function(e) {
                                console.log(e);
                            }
                        });
                    },
                    failure: function(e) {
                        console.log(e);
                    }
                });
            },
            scope: this
        });
    },

    _setDiv: function(value, cls) {
        return '<div class=' + cls + '>'+value+'</div>';
    },

    _getAttributes: function(typeDef) {
        var deferred = Ext.create('Deft.Deferred');
        typeDef.getCollection('Attributes').load({
            filters: [
                {
                    property: 'Custom',
                    value: true
                }
            ],
            fetch: true
        }).then({
            success: function (results) {
                deferred.resolve({typeDef: typeDef, results: results});
            },
            failure: function() {
                deferred.reject('Failed to get Attributes for: ' + typeDef.ElementName);
            }
        });
        return deferred.promise;
    },

    _getOccurrences: function(attrOid, typeDefOid) {
        var me = this;
        var deferred = Ext.create('Deft.Deferred');
        var getReq = new XMLHttpRequest();
        getReq.onloadend = function(event) { 
            me._loadHandler(event,deferred);
        };

        getReq.onabort = function() {
            me._abortHandler(deferred);
        };

        getReq.ontimeout = function() {
            me._timeoutHandler(deferred);
        };
//        getReq.timeout = timeout;
        getReq.withCredentials = true;
        getReq.open("GET", me.serverURL + '?cpoid=' + this.getContext().getProject().ObjectID +
            '&attrDefOid=' + attrOid +
            '&typeDefOid=' + typeDefOid, true);
        getReq.send(null);
        return deferred.promise;
    },

    _loadHandler: function(event, deferred) {
        var results = event.target.responseText;
        if (results.slice(0,20).search("!DOCTYPE") > 0) {   //This happens on an unexpected server error.
            deferred.resolve([]);
            return;
        }
        if ((event.target.readyState === 4) && (event.target.status === 200)){
            results = JSON.parse(event.target.responseText);
            console.log(results);
            deferred.resolve(results);
        }
        else if ((event.target.readyState === 4) && (event.target.status === 0)){
            console.log('Non Specified Fail', event);
        }
        else {
            console.log('Non Data Response', event);
        }
    },

    _abortHandler: function() {
        debugger;
    },

    _timeoutHandler: function() {
        debugger;
    }
});
