/**
 * This class is used by the marketingCloudCommitTable Lightning Web Component, 
 * responsible for Showing commitable Metadata, 
 * displayed in a table, 
 * and based on the User Story Object

 copado__User_Story__r.copado__Project__r.copado__Deployment_Flow__c.copado__Git_Repository__c
 
 */
public with sharing class RunCopadoFunctionFromLWC {

    /**
     * This function reads the, by the retrieve method created, latest file with the commitable Metadata
     * @return      Returns the content of the file with the Metadata
     */
    @AuraEnabled
    public static String getMetadataFromEnvironment() {
        try {
            String data;

            List<ContentDocumentLink> cDI = [
                SELECT ContentDocumentId 
                FROM ContentDocumentLink 
                WHERE LinkedEntityId = 'a0V09000000rIkdEAE'
            ];

            if(!cDI.isEmpty()) {

                Integer lastIndexCDI = cDI.size() - 1;
                String contentDocumentId = cDI[lastIndexCDI].ContentDocumentId;

                
                List <ContentVersion> content = [
                    SELECT VersionData, ContentDocument.Title 
                    FROM ContentVersion 
                    WHERE ContentDocumentId = :contentDocumentId
                    AND ContentDocument.Title = 'mcmetadata.json'
                ];

                if(!content.isEmpty()) {
                    data = content[0].VersionData.toString();
                }
            }
            return data;
            
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * This function calls the MC_Retrieve Copado Function and passes the parameters accordingly. 
     * This should retrieve the available Metadata, that is available for Commits, and save it to a file,
     * which then can be read by the getMetadataFromEnvironment method, to render the data client-side.
     * @param envId			            Passed into the MC_Retrieve Copado Script.
     * @param userStoryName		        Passed into the MC_Retrieve Copado Script.				
     * @return 			                Returs the ID of the result of running the Copado Commit Script MC_Retrieve.
     */
    @AuraEnabled
    public static String executeRetrieve(
        String userStoryId
        ) {

            List<copado__User_Story__c> userStory;
            Id projectId;
            Id envId;

            try {
                userStory = [
                    SELECT copado__Environment__c, copado__Project__c 
                    FROM copado__User_Story__c 
                    WHERE Id = :userStoryId
                ];
                projectId = userStory[0].copado__Project__c;
                envId = userStory[0].copado__Environment__c;
            } catch (Exception e) {
                throw new AuraHandledException(e.getMessage());
            }


            List<copado__Project__c> project;
            Id pipelineId;

            try {
                project = [
                    SELECT copado__Deployment_Flow__c 
                    FROM copado__Project__c 
                    WHERE Id = :projectId
                ];
                pipelineId = project[0].copado__Deployment_Flow__c;
            } catch (Exception e) {
                throw new AuraHandledException(e.getMessage());
            }


            List<copado__Deployment_Flow__c> pipeline;
            Id repositoryId;
            String mainBranch;

            try {
                pipeline = [
                    SELECT copado__Git_Repository__c, copado__Main_Branch__c
                    FROM copado__Deployment_Flow__c 
                    WHERE Id = :pipelineId
                ];
                repositoryId = pipeline[0].copado__Git_Repository__c;
                mainBranch = pipeline[0].copado__Main_Branch__c;
            } catch (Exception e) {
                throw new AuraHandledException(e.getMessage());
            }

            try {                
                String templateName = 'MC_Retrieve_Action_1';

                copado.CreateExecution.Request request = new copado.CreateExecution.Request();
                request.parentId = userStoryId; 
                request.templateName = templateName; 
                request.pipelineId = pipelineId;
                request.sourceId = envId; 
                request.runAfterInstantiation = true; 

                List<copado__JobExecution__c> jobExecution = copado.CreateExecution.execute(new List<copado.CreateExecution.Request>{ request });
                
                Id jobExecutionId = jobExecution[0].Id;
                return jobExecutionId;

            } catch (Exception e) {
                throw new AuraHandledException(e.getMessage());
            }
        }
}