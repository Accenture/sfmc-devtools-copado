/**
 * This class is used by the MC Init function, 
 * responsible for creating all environments 
 */
Global class mcdo_CreateEnvironments implements copado.MCCallback {
    Global void execute(copado__Function__c function, copado__Result__c result, String status) {
        if(status == 'Failed') {
            // handle Error
        } else if(status == 'Success') {
            // handle Success
            System.debug('Entered the createEnvironments callback function with the status equals to "Success"');
        } else {
            // handle In progress if necessary
        }
    }
}