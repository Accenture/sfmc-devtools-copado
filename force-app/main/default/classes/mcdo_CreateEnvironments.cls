/**
 * This class is used by the MC Init function, g
 * responsible for creating all environments 
 */
global class mcdo_CreateEnvironments implements copado.JobExecutionCallback  {
    global void execute(copado__JobExecution__c job, String status) {
        if(status == 'Error') {
            // handle Error
            System.debug('Error: ' + job.copado__ErrorMessage__c);
        } else if(status == 'Successful') {
            // handle Success
            System.debug('Job: ' + job);
            // TODO: create all the needed environments
            
        } else {
            // handle In progress if necessary
            System.debug('still in progress...');
        }
    }
}