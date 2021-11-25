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

            String credentialName = 'Copado-MarkClDevOps';
            String mcdevVersion = '3.0.3';
            String clientId = 'uk9mnvcpt0q8aqwu8p8hs5oz';
            String clientSecret = 'GlplqKwMcG84iS08oSkUWu2k';
            String tenant= 'mct0l7nxfq2r988t1kxfy8sc47mq'; 

            String gitJson = '{$Context.Repository.Credential}';

            String parametersJSON;

            try {
                parametersJSON = '[{ "name" : "envId", "value" : "'+ envId + '"},{ "name" : "git_json", "value" : "' + gitJson + '"},{ "name" : "main_branch", "value" : "'+ mainBranch + '"},{ "name" : "mcdev_version", "value" : "'+ mcdevVersion + '"},{ "name" : "clientId", "value" : "'+ clientId + '"},{ "name" : "clientSecret", "value" : "'+ clientSecret + '"},{ "name" : "tenant", "value" : "'+ tenant + '"},{ "name" : "credentialName", "value" : "'+ credentialName + '"}]';
            } catch (Exception e) {
                throw new AuraHandledException(e.getMessage());
            }

            

            String copadoFunctionApiName = 'MC_Retrieve';
            //String contextId; // = 'a0h09000000eAZkAAM'; //temporary workaround
            Boolean showValidationErrors = true;         
            

            /*
            try {
                List<copado__User_Story__c> UserStoryEnv = [
                    SELECT copado__Environment__c 
                    FROM copado__User_Story__c
                    WHERE Id = :userStoryId
                ];
                envId = UserStoryEnv[0].copado__Environment__c;
            } catch (Exception e) {
                throw new AuraHandledException(e.getMessage());
            }
            */

            

            

            
            

            try {                
                // Instaciate apex-copado__RunCopadoFunction.InvocableVariables to set the instance variables
                copado.RunCopadoFunction.InvocableVariables invocableVariable = new copado.RunCopadoFunction.InvocableVariables();

                invocableVariable.functionApiName = copadoFunctionApiName;
                invocableVariable.contextId = repositoryId;
                invocableVariable.showValidationErrors = showValidationErrors;
                invocableVariable.parametersJSON = parametersJSON;

                // Now invoke it as a list
                List<String> result = copado.RunCopadoFunction.execute(new List<copado.RunCopadoFunction.InvocableVariables> { invocableVariable });

                String resultId = result[0];

                return resultId;
            } catch (Exception e) {
                throw new AuraHandledException(e.getMessage());
            }
        }
}