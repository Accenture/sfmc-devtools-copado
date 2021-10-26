/**
 * This class is used by the marketingCloudCommitTable Lightning Web Component, 
 * responsible for Showing commitable Metadata, 
 * displayed in a table, 
 * and based on the User Story Object
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
        Id envId, 
        String userStoryName
        ) {
            try {
                String copadoFunctionApiName = 'MC_Retrieve';
                String contextId = '';
                Boolean showValidationErrors = true;
                
                String parametersJSON = '[{ "name" : "envId", "value" : "'+ envId + '"},{ "name" : "userStoryName", "value" : "' + userStoryName + '"}]';
                System.debug('parametersJSON ' + parametersJSON);

                // Instaciate apex-copado__RunCopadoFunction.InvocableVariables to set the instance variables
                copado.RunCopadoFunction.InvocableVariables invocableVariable = new copado.RunCopadoFunction.InvocableVariables();


                invocableVariable.functionApiName = copadoFunctionApiName;
                invocableVariable.contextId = contextId;
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