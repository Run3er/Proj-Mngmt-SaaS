
angular.module('ProjMngmnt')
    .controller('EntriesCtrl', function (Sidebar, DB, UI, $scope, entrySpecifics) {
        // Navigation setup (not using onEnter because it's triggered before parent controller execution)
        Sidebar.setActiveMenuUrlBySuffix(entrySpecifics.type + "s");


        // Functions definition

        // Reset form
        var formReset = function () {
            $scope.form.$setPristine();
            $scope.form.$setUntouched();
        };

        // On form reset
        $scope.formCancel = function() {
            formReset();
            // Reset specific variables
            $scope.formEntry = {};
            // Revert submit to default operation
            if ($scope.formAction.submit !== add) {
                $scope.formAction = {
                    submit: add,
                    submitBtnText: "Ajouter",
                    title: viewData.form.title.add
                };
            }
            // Cancel current entry editing
            if (editingEntryIdx !== void(0)) {
                $scope.tableEntries.rows[editingEntryIdx].onEdit = false;
                editingEntryIdx = void(0);
            }
        };

        // On entry edit
        $scope.edit = function (entryIdx) {
            $scope.formAction.submit = void(0);
            formReset();
            // Cancel current entry editing
            if (editingEntryIdx !== void(0)) {
                $scope.tableEntries.rows[editingEntryIdx].onEdit = false;
            }
            editingEntryIdx = entryIdx;
            $scope.tableEntries.rows[entryIdx].onEdit = true;
            $scope.formAction.title = viewData.form.title.edit;
            $scope.formAction.submitBtnText = "Mettre à jour";
            $scope.formEntry = angular.copy(entries[entryIdx]);

            //collapse form in
            //color corresponding entry in table

            $scope.formAction.submit = update;
        };

        // On entry delete
        $scope.delete = function (entryIdx) {
            $scope.tableEntries.rows[entryIdx].onDelete = true;
            var entryID = entries[entryIdx].id;

            request("delete", entryID)
                .then(function () {
                    // Deleting by swapping places (& indexes) with last row, avoiding array indexes offsetting alternative
                    if (entryIdx !== $scope.tableEntries.rows.length - 1) {
                        var updatedEntry;
                        // Delete entry from raw entries data
                        updatedEntry = entries[entries.length - 1];
                        entries.splice(entries.length - 1, 1);
                        entries[entryIdx] = updatedEntry;
                        // Delete view-only entry
                        updatedEntry = $scope.tableEntries.rows[$scope.tableEntries.rows.length - 1];
                        updatedEntry.index = entryIdx;
                        $scope.tableEntries.rows.splice($scope.tableEntries.rows.length - 1, 1);
                        $scope.tableEntries.rows[entryIdx] = updatedEntry;
                    }
                    else {
                        // Delete entry from raw entries data
                        entries.splice(entryIdx, 1);
                        // Delete view-only entry
                        $scope.tableEntries.rows.splice(entryIdx, 1);
                    }

                    // Cancel update if deleted
                    if (editingEntryIdx === entryIdx) {
                        editingEntryIdx = void(0);
                        $scope.formCancel();
                    }
                    // Adjust indexes if entry being edited was the swapped entry
                    else if (editingEntryIdx === $scope.tableEntries.rows.length) {
                        editingEntryIdx = entryIdx;
                    }

                    // Finish, execute deletion animation

                }, function () {
                    $scope.tableEntries.rows[entryIdx].onDelete = false;
                });
        };


        // Add entry
        var add = function () {
            $scope.formSubmitEnabled = false;
            var entry = angular.copy($scope.formEntry);

            request("add", entry)
                .then(function (addedEntryID) {
                    // Add entry to raw entries data
                    entry.id = addedEntryID;
                    entries.push(entry);

                    var tableRow = angular.copy(entry);
                    // Update view-only-entry's auto generated fields
                    generateAutoFields([entry], [tableRow]);
                    // Add row's array index as a field
                    tableRow.index = $scope.tableEntries.rows.length;
                    $scope.tableEntries.rows.push(tableRow);

                    // Finish, reset form to initial state
                    $scope.formCancel();
                })
                .finally(function () {
                    $scope.formSubmitEnabled = true;
                });
        };

        // Update entry
        var update = function () {
            $scope.formSubmitEnabled = false;
            var entry = angular.copy($scope.formEntry);

            request("update", entry)
                .then(function () {
                    // Edit entry on raw entries data
                    entry.id = entries[editingEntryIdx].id;
                    entries[editingEntryIdx] = entry;

                    // Update view-only-entry auto generated fields
                    var tableRow = angular.copy(entry);
                    generateAutoFields([entry], [tableRow]);
                    tableRow.index = editingEntryIdx;
                    $scope.tableEntries.rows[editingEntryIdx] = tableRow;

                    // Finish, reset form & table to inactive state
                    $scope.formCancel();
                })
                .finally(function () {
                    $scope.formSubmitEnabled = true;
                });
        };

        // Async. request operation
        var request = function (operationType, argument) {
            // Set local copy of argument
            var arg = angular.copy(argument);

            // Request operation to DB asynchronously
            var resultPromise = entriesDAO[operationType](arg);
            resultPromise
                // Update  alert
                .catch(function () {
                    $scope.formAlert.msg = operationType + " failed. [Try again.]";
                    $scope.formAlert.didSucceed = false;
                    $scope.formAlert.active = true;
                });

            return resultPromise;
        };

        /**
         * Generate view-only auto-calculated fields
         * @param _entries reference non-updated raw entries
         * @param _rows entries to be modified
         * @param _columnMaps table header and mapping to be modified
         */
        var generateAutoFields = function (_entries, _rows, _columnMaps) {
            // Add view-only auto generated values to tableEntries
            if (viewData.table.generatedFields !== void(0)) {
                for (var j = 0; j < viewData.table.generatedFields.length; j++) {
                    if (_columnMaps !== void(0)) {
                        // Add to columnMaps
                        var position = viewData.table.generatedFields[j].position;
                        _columnMaps.splice(position, 0, {
                            key: viewData.table.generatedFields[j].key,
                            name: viewData.table.generatedFields[j].columnName
                        });
                    }

                    // Add to each row
                    for (var i = 0; i < _entries.length; i++) {
                        var generatedField = viewData.table.generatedFields[j].formula(_entries[i]);
                        _rows[i][viewData.table.generatedFields[j].key] = generatedField;
                    }
                }
            }
            // Translate enum values to display values
            for (var i = 0; i < viewData.form.fields.length; i++) {
                if (viewData.form.fields[i].choices !== void(0)) {
                    for (var j = 0; j < _entries.length; j++) {
                        for (var k = 0; k < viewData.form.fields[i].choices.length; k++) {
                            if (viewData.form.fields[i].choices[k].identifier === _entries[j][viewData.form.fields[i].identifier]) {
                                _rows[j][viewData.form.fields[i].identifier] = viewData.form.fields[i].choices[k].value;
                                break;
                            }
                        }
                    }
                }
            }
        };


        // Controller init. code, Prepare table entries for display

        // Get DAO
        var uriPrefix = void(0);
        if (entrySpecifics.urlPrefix !== void(0)) {
            var urlParts = entrySpecifics.urlPrefix.split("/");
            if (urlParts.length > 1) {
                // URI resource name + id
                uriPrefix = urlParts[urlParts.length - 2] + "/" + urlParts[urlParts.length - 1];
            }
        }
        var entriesDAO = DB.getEntriesDAO({
            type: entrySpecifics.type,
            uriPrefix: uriPrefix
        });

        // Get DB layer entries data
        var entries;
        request("getAll")
            .then(function (resolveData) {
                    // Get the requested data
                    entries = angular.copy(resolveData);

                    var rows = angular.copy(entries);
                    var columnMaps = angular.copy(viewData.table.columnMaps);

                    // Initialize with initial data when available (fetched w/entry)
                    for (var i = 0; i < columnMaps.length; i++) {
                        if (columnMaps[i].initialValueKey !== void(0)) {
                            for (var j = 0; j < rows.length; j++) {
                                rows[j][columnMaps[i].key] = rows[j][rows[columnMaps[i].initialValueKey]];
                            }
                        }
                    }

                    // Add view-only auto generated fields to tableEntries
                    generateAutoFields(entries, rows, columnMaps);
                    // Add row's array index to each row (for ng-repeat)
                    for (var i = 0; i < rows.length; i++) {
                        rows[i].index = i;
                    }

                    $scope.tableEntries = {
                        columnMaps: columnMaps,
                        rows: rows,
                        linkable: {
                            columnKey: viewData.table.columnKeyLinkable,
                            urlPrefix: (entrySpecifics.urlPrefix ? entrySpecifics.urlPrefix + "/" :"") + entrySpecifics.type + "s"
                        }
                    };
                },
                function () {
                    // Set alert on the view
                    $scope.formAlert.msg = "Getting entries failed. [Try refreshing.]";
                    $scope.formAlert.didSucceed = false;
                    $scope.formAlert.active = true;
                });


        // Get view layer entries data
        var viewData = UI.getEntryViewData(entrySpecifics.type);

        // Fetch async view data, namely multiple choice inputs
        viewData.form.fields.forEach(function (formField) {
            if (formField.asyncChoices !== void(0)) {
                DB
                    .getEntriesDAO({
                        type: formField.asyncChoices.entriesName
                    })
                    .getAll()
                    .then(function (entries) {
                        formField.choices = [];

                        for (var i = 0; i < entries.length; i++) {
                            // Filter with specified filters
                            var keys = Object.keys(formField.asyncChoices.filterBy);
                            var passedFilter = true;
                            for (var j = 0; j < keys.length; j++) {
                                if (entries[i][keys[j]] !== formField.asyncChoices.filterBy[keys[j]]) {
                                    passedFilter = false;
                                    break;
                                }
                            }
                            if (!passedFilter) continue;

                            formField.choices.push({
                                identifier: formField.asyncChoices.entriesName + "s" + "/" + entries[i].id,
                                value: entries[i][formField.asyncChoices.attachedFieldName]
                            });
                        }
                    });
            }
        });


        // Initialize form
        $scope.formFields = viewData.form.fields;
        $scope.defaultSortingField = viewData.form.defaultSortingField;
        $scope.formEntry = {};
        $scope.formAlert = {};
        $scope.formSubmitEnabled = true;
        $scope.formAction = {
            title: viewData.form.title.add,
            submit: add,
            submitBtnText: "Ajouter"
        };
        // On view content fully loaded
        // $scope.$on('$viewContentLoaded', function(){
        // 	formReset();
        // });
        var editingEntryIdx;
    });

    //TODO: show notification only on request failure