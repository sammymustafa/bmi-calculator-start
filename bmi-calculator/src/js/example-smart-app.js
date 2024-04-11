(function (window) {
    window.extractData = function () {
        var ret = $.Deferred();

        function onError() {
            console.log('Loading error', arguments);
            ret.reject();
        }

        function onReady(smart) {

            if (smart.hasOwnProperty('patient')) {

                var patient = smart.patient;
                var pt = patient.read();
                var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                    query: {
                        code: {
                            $or: [
                                'http://loinc.org|8302-2',     // Height
                                'http://loinc.org|3137-7',     // Height [measured]
                                'http://loinc.org|3138-5',     // Height [stated]
                                'http://loinc.org|8308-9',     // Height [standing]
                                'http://loinc.org|8306-3',     // Height [lying]
                                'http://loinc.org|8301-4',     // Height [estimated]

                                'http://loinc.org|29463-7',    // Weight
                                'http://loinc.org|3141-9',     // Weight
                                'http://loinc.org|18833-4',    // Weight
                                'http://loinc.org|3142-7',     // Weight [stated]
                                'http://loinc.org|75292-3',    // Weight [usual]
                                'http://loinc.org|8335-2',     // Weight [estimated]
                                'http://loinc.org|8351-9'      // Weight [without clothes]
                            ]
                        }
                    }
                });
                var cond = smart.patient.api.fetchAll({
                    type: 'Condition',
                    query: {}
                })

                $.when(pt, obv, cond).fail(onError);

                $.when(pt, obv, cond).done(function (patient, obv, conditions) {

                    var byCodes = smart.byCodes(obv, 'code');
                    var gender = patient.gender;
                    var fname = '';
                    var lname = '';
                    var city = patient.address[0].city;
                    var state = patient.address[0].state;
                    var country = patient.address[0].country;

                    if (typeof patient.name[0] !== 'undefined') {
                        fname = patient.name[0].given.join(' ');
                        lname = patient.name[0].family.join(' ');
                    }

                    // Create arrays of JSON objects
                    var height = byCodes('8302-2', '3137-7', '3138-5', '8308-9', '8306-3', '8301-4');
                    var weight = byCodes('29463-7', '3141-9', '18833-4', '3142-7', '75292-3', '8335-2', '8351-9');

                    // Set default patient object
                    var p = defaultPatient();

                    // Patient demographics
                    p.birthdate = patient.birthDate;
                    p.gender = gender;
                    p.city = city;
                    p.state = state;
                    p.country = country;
                    p.fname = fname;
                    p.lname = lname;

                    // Height
                    p.height = getQuantityValueAndUnit(height[0]);
                    // p.height = JSON.stringify(height[0]) // Delete this line when instructed

                    // Weight
                    p.weight = getQuantityValueAndUnit(weight[0]);

                    // Calculate BMI
                    p.bmi = (getQuantityValue(weight[0]) / (Math.pow((getQuantityValue(height[0]) / 100), 2))).toFixed(1);

                    // 

                    // Condition
                    p.condition = null;
                    p.other = null;
                    if (conditions && conditions.length > 0) {
                        // Create an array to hold all SNOMED CT coding entries
                        var allSnomedCodings = [];

                        // Collect all SNOMED CT coding entries from each condition
                        conditions.forEach(function(condition) {
                            if (condition.code && condition.code.coding) {
                                condition.code.coding.forEach(function(coding) {
                                    if (coding.system === "http://snomed.info/sct") {
                                        allSnomedCodings.push(coding);
                                    }
                                });
                            }
                        });

                        // Sort the coding entries by the length of their display name
                        allSnomedCodings.sort(function(a, b) {
                            return a.display.length - b.display.length || a.display.localeCompare(b.display);
                        });

                        // Now assign the SNOMED code with the shortest display name to p.condition
                        // and the next shortest to p.other
                        if (allSnomedCodings.length > 0) {
                            p.condition = allSnomedCodings[0].display;
                            console.log("Condition with shortest display name:", p.condition);
                        }

                        if (allSnomedCodings.length > 1) {
                            p.other = allSnomedCodings[1].display;
                            console.log("Second condition with shortest display name:", p.other);
                        }
                    }

                    // Make sure to output a message if no codes were found
                    if (!p.condition) {
                        console.log("No SNOMED codes found for 'condition' variable.");
                    }
                    if (!p.other) {
                        console.log("No additional SNOMED codes found for 'other' variable.");
                    }
                    ret.resolve(p);

                });

            } else {
                onError();
            }
        }
        FHIR.oauth2.ready(onReady, onError);
        return ret.promise();
    };

    // Default patient parameters
    function defaultPatient() {

        return {
            fname: { value: '' },
            lname: { value: '' },
            gender: { value: '' },
            birthdate: { value: '' },
            height: { value: '' },
            weight: { value: '' },
            condition: { value: '' },
            other: {value: ''},
            bmi: { value: '' },
            city: { value: '' },
            state: { value: '' },
            country: { value: '' }
        };
    }

    // Get numerical value and unit of observations 
    function getQuantityValueAndUnit(ob) {

        if (typeof ob != 'undefined' &&
            typeof ob.valueQuantity != 'undefined' &&
            typeof ob.valueQuantity.value != 'undefined' &&
            typeof ob.valueQuantity.unit != 'undefined') {

            return ob.valueQuantity.value.toFixed(1) + ' ' + ob.valueQuantity.unit;

        } else {
            return undefined;
        }
    }

    // Get only numerical value of observations
    function getQuantityValue(ob) {

        if (typeof ob != 'undefined' &&
            typeof ob.valueQuantity != 'undefined' &&
            typeof ob.valueQuantity.value != 'undefined') {

            return ob.valueQuantity.value;

        } else {
            return undefined;
        }
    }

    // Draw, show, or hide corresponding HTML on index page
    window.drawVisualization = function (p) {
        $('#holder').show();
        $('#loading').hide();
        $('#fname').html(p.fname);
        $('#lname').html(p.lname);
        $('#gender').html(p.gender);
        $('#birthdate').html(p.birthdate);
        $('#height').html(p.height);
        $('#weight').html(p.weight);
        $('#condition').html(p.condition);
        $('#other').html(p.other);
        $('#bmi').html(p.bmi);
        $('#city').html(p.city);
        $('#state').html(p.state);
        $('#country').html(p.country);
    };

})(window);