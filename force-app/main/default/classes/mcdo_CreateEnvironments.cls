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
            System.debug('Job.copado__DataJson__c: ' + job.copado__DataJson__c);            
            // TODO: create all the needed environments
            List<Object> dataJson = (List<Object>)JSON.deserializeUntyped(job.copado__DataJson__c);
            System.debug(dataJson);
            for(Object dt : dataJson){
                System.debug('Entered the for loop');
                Map<String,Object> data = (Map<String,Object>)dt;
                System.debug(data.get('Name'));
            }
            
        } else {
            // handle In progress if necessary
            System.debug('still in progress...');
        }
    }
}