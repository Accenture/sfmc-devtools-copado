// Note: This class have been used as Dynamic Expression class for Marketing Cloud functions - Hence marked Global
// Call this Dynamic Expression as {$Context.Apex.mcdo_GetPropertiesOfUSsInPromotion} in a Promotion or Deployment Job Step
// "Context" in this case refers to the Job Step of a Job Execution
@SuppressWarnings('PMD.AvoidGlobalModifier')
global with sharing class mcdo_GetPropertiesOfUSsInPromotion implements copado.ParameterExpressionCallable {
    global String execute(Id contextId) {
        Map<Id, Id> firstEnvironmentPerPromotion = getFirstEnvironmentPerPromotion(contextId);
        // now allProperties[] have all the properties of all the source environments of all the user stories
        copado__System_Property__c[] allProperties = [
            SELECT copado__API_Name__c, copado__Value__c
            FROM copado__System_Property__c
            WHERE copado__ParentId__c IN :firstEnvironmentPerPromotion.values()
        ];
        System.debug('allProperties=' + allProperties);
        return JSON.serialize(allProperties);
    }

    // PRIVATE

    private Map<Id, Id> getFirstEnvironmentPerPromotion(Id contextId) {
        copado__JobStep__c step = [
            SELECT
                copado__JobExecution__r.copado__Promotion__c,
                copado__JobExecution__r.copado__Deployment__r.copado__Promotion__c
            FROM copado__JobStep__c
            WHERE Id = :contextId
        ];
        String promotionId = String.isEmpty(step.copado__JobExecution__r.copado__Promotion__c)
            ? step.copado__JobExecution__r.copado__Deployment__r.copado__Promotion__c
            : step.copado__JobExecution__r.copado__Promotion__c;
        if (String.isEmpty(promotionId)) {
            throw new QueryException(
                'Could not find a Promotion for this Context. Ensure this is called in a Promotion or Deployment Job'
            );
        }

        Set<Id> ids = new Set<Id>();
        copado__Promoted_User_Story__c[] promotedUserStories = [
            SELECT copado__User_Story__c
            FROM copado__Promoted_User_Story__c
            WHERE copado__Promotion__c = :promotionId
        ];
        for (copado__Promoted_User_Story__c promotedUserStory : promotedUserStories) {
            ids.add(promotedUserStory.copado__User_Story__c);
        }
        System.debug('userStories=' + ids);

        // now lets find the first promoted user story record per each user story
        copado__Promoted_User_Story__c[] usps = [
            SELECT copado__User_Story__c, copado__Promotion__r.copado__Source_Environment__c
            FROM copado__Promoted_User_Story__c
            WHERE copado__User_Story__c IN :ids
            ORDER BY CreatedDate ASC
        ];
        Map<Id, Id> firstEnvironmentPerPromotion = new Map<Id, Id>();
        for (copado__Promoted_User_Story__c usp : usps) {
            if (!firstEnvironmentPerPromotion.containsKey(usp.copado__User_Story__c)) {
                firstEnvironmentPerPromotion.put(
                    usp.copado__User_Story__c,
                    usp.copado__Promotion__r.copado__Source_Environment__c
                );
            }
        }
        System.debug(firstEnvironmentPerPromotion);
        return firstEnvironmentPerPromotion;
    }
}
