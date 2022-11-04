// Note: This class have been used as Dynamic Expression class for Marketing Cloud functions - Hence marked Global
@SuppressWarnings('PMD.AvoidGlobalModifier')
global with sharing class mcdo_SourceChildEnvironmentVariables implements copado.ParameterExpressionCallable {
    // GLOBAL

    private Map<String, List<EnvironmentVariablesRecord>> envVariablesByEnvName = new Map<String, List<EnvironmentVariablesRecord>>();

    global String execute(Id contextId) {
        Map<Id, Id> firstEnvironmentPerPromotion = getFirstEnvironmentPerPromotion(contextId);
        Id environmentId = getParentEnvironmentId(firstEnvironmentPerPromotion.values()[0]);

        List<Environment> result = new List<Environment>();
        for (
            copado__Environmental_Variable__c environmentVariable : getEnvironmentVariables(
                environmentId
            )
        ) {
            List<EnvironmentVariablesRecord> environmentVariables = new List<EnvironmentVariablesRecord>();
            if (
                envVariablesByEnvName.containsKey(environmentVariable.copado__Environment__r.name)
            ) {
                environmentVariables = envVariablesByEnvName.get(
                    environmentVariable.copado__Environment__r.name
                );
            }

            environmentVariables.add(new EnvironmentVariablesRecord(environmentVariable));
            envVariablesByEnvName.put(
                environmentVariable.copado__Environment__r.name,
                environmentVariables
            );
        }

        for (copado__Environment__c eachEnvironment : getChildEnvironments(environmentId)) {
            List<EnvironmentVariablesRecord> environmentVariables = new List<EnvironmentVariablesRecord>();
            if (envVariablesByEnvName.containsKey(eachEnvironment.Name)) {
                environmentVariables = envVariablesByEnvName.get(eachEnvironment.Name);
            }
            result.add(
                new Environment(eachEnvironment.Name, eachEnvironment.Id, environmentVariables)
            );
        }
        return JSON.serialize(result);
    }

    // PRIVATE

    private List<copado__Environmental_Variable__c> getEnvironmentVariables(Id environmentId) {
        return [
            SELECT Id, Name, copado__Value__c, copado__Scope__c, copado__Environment__r.name
            FROM copado__Environmental_Variable__c
            WHERE copado__Environment__r.mcdo_Parent_Environment__c = :environmentId
            WITH SECURITY_ENFORCED
            ORDER BY Name
        ];
    }

    private List<copado__Environment__c> getChildEnvironments(Id environmentId) {
        return [
            SELECT Id, Name
            FROM copado__Environment__c
            WHERE mcdo_Parent_Environment__c = :environmentId
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
    // used in case of stacked parent BUs - but only if the current env has mcdo_Is_Enterprise_BU__c==true
    private Id getParentEnvironmentId(Id environmentId) {
        copado__Environment__c currentEnv = [
            SELECT Id, mcdo_Is_Enterprise_BU__c
            FROM copado__Environment__c
            WHERE Id = :environmentId
            WITH SECURITY_ENFORCED
        ];
        if (currentEnv.mcdo_Is_Enterprise_BU__c) {
            // check if there is only one child
            List<copado__Environment__c> children = [
                SELECT Id, Name
                FROM copado__Environment__c
                WHERE mcdo_Parent_Environment__c = :environmentId
                WITH SECURITY_ENFORCED
            ];
            if (!children.isEmpty() && children.size() == 1) {
                // check if child has children itself
                Id childEnvId = children[0].Id;
                List<copado__Environment__c> childrenOfChild = [
                    SELECT Id, Name
                    FROM copado__Environment__c
                    WHERE mcdo_Parent_Environment__c = :childEnvId
                    WITH SECURITY_ENFORCED
                ];
                if (!childrenOfChild.isEmpty() && childrenOfChild.size() > 0) {
                    // if 1..n children are found, we want the rest of the code show variables for those environments instead
                    return childEnvId;
                }
            }
        }
        // fallback; return what we've already had in the beginning
        return environmentId;
    }

    // WRAPPER

    public class EnvironmentVariablesRecord {
        public String id { get; set; }
        public String name { get; set; }
        public String value { get; set; }
        public String scope { get; set; }

        public EnvironmentVariablesRecord(copado__Environmental_Variable__c environmentVariable) {
            this.id = environmentVariable.Id;
            this.name = environmentVariable.Name;
            this.value = environmentVariable.copado__Value__c;
            this.scope = environmentVariable.copado__Scope__c;
        }
    }

    public class Environment {
        public String name { get; set; }
        public String id { get; set; }
        public List<EnvironmentVariablesRecord> environmentVariables { get; set; }

        public Environment(
            String name,
            String id,
            List<EnvironmentVariablesRecord> environmentVariables
        ) {
            this.name = name;
            this.id = id;
            this.environmentVariables = environmentVariables;
        }
    }
}
