// Note: This class have been used as Dynamic Expression class for Marketing Cloud functions - Hence marked Global
@SuppressWarnings('PMD.AvoidGlobalModifier')
global with sharing class mcdo_ChildEnvironmentVariables implements copado.ParameterExpressionCallable {

    // GLOBAL
  

    private Map<String, List<EnvironmentVariablesRecord>> envVariablesByEnvName = new Map<String, List<EnvironmentVariablesRecord>>();

    global String execute(Id environmentId) {
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

        for (copado__Environment__c eachEnvironment : getmcdo_ChildEnvironments(environmentId)) {
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

    private List<copado__Environment__c> getmcdo_ChildEnvironments(Id environmentId) {
        return [
            SELECT Id, Name
            FROM copado__Environment__c
            WHERE mcdo_Parent_Environment__c = :environmentId
            WITH SECURITY_ENFORCED
        ];
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