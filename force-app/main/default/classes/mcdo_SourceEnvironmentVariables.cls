@SuppressWarnings('PMD.AvoidGlobalModifier')
global with sharing class mcdo_SourceEnvironmentVariables implements copado.ParameterExpressionCallable {
    // GLOBAL

    global String execute(Id contextId) {
        Map<Id, Id> firstEnvironmentPerPromotion = getFirstEnvironmentPerPromotion(contextId);

        List<EnvironmentVariablesRecord> result = new List<EnvironmentVariablesRecord>();
        for (
            copado__Environmental_Variable__c environmentVariable : getEnvironmentVariables(
                firstEnvironmentPerPromotion.values()
            )
        ) {
            result.add(
                new EnvironmentVariablesRecord(
                    environmentVariable.Name,
                    environmentVariable.copado__Value__c,
                    environmentVariable.copado__Scope__c
                )
            );
        }

        return JSON.serialize(result);
    }

    // PRIVATE

    private List<copado__Environmental_Variable__c> getEnvironmentVariables(
        List<Id> environmentId
    ) {
        return [
            SELECT Id, Name, copado__Value__c, copado__Scope__c
            FROM copado__Environmental_Variable__c
            WHERE copado__Environment__c IN :environmentId
            WITH SECURITY_ENFORCED
        ];
    }

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

    // WRAPPER

    public class EnvironmentVariablesRecord {
        public String name { get; set; }
        public String value { get; set; }
        public String scope { get; set; }

        public EnvironmentVariablesRecord(String n, String v, String s) {
            this.name = n;
            this.value = v;
            this.scope = s;
        }
    }
}
