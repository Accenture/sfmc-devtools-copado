// Note: This class have been used as Dynamic Expression class for Marketing Cloud functions - Hence marked Global
@SuppressWarnings('PMD.AvoidGlobalModifier')
global with sharing class mcdo_ChildEnvironmentVariables implements copado.ParameterExpressionCallable {
    // GLOBAL

    private Map<String, List<EnvironmentVariablesRecord>> envVariablesByEnvName = new Map<String, List<EnvironmentVariablesRecord>>();

    global String execute(Id environmentId) {
        environmentId = getParentEnvironmentId(environmentId);

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
