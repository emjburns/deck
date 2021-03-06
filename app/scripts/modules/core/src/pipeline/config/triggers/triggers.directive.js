'use strict';

import { extend } from 'lodash';

import { ArtifactReferenceService } from 'core/artifact/ArtifactReferenceService';
import { ExpectedArtifactService } from 'core/artifact/expectedArtifact.service';
import { Registry } from 'core/registry';
import { SETTINGS } from 'core/config/settings';
import { PipelineConfigValidator } from 'core/pipeline';

const angular = require('angular');

module.exports = angular
  .module('spinnaker.core.pipeline.config.trigger.triggersDirective', [])
  .directive('triggers', function() {
    return {
      restrict: 'E',
      scope: {
        pipeline: '=',
        application: '=',
        fieldUpdated: '<',
      },
      controller: 'triggersCtrl',
      controllerAs: 'triggersCtrl',
      templateUrl: require('./triggers.html'),
    };
  })
  .controller('triggersCtrl', [
    '$scope',
    function($scope) {
      this.showProperties = SETTINGS.feature.quietPeriod || SETTINGS.feature.managedServiceAccounts;
      this.addTrigger = function() {
        var triggerTypes = Registry.pipeline.getTriggerTypes(),
          newTrigger = { enabled: true };
        if (!$scope.pipeline.triggers) {
          $scope.pipeline.triggers = [];
        }

        if (triggerTypes.length === 1) {
          newTrigger.type = triggerTypes[0].key;
        }
        $scope.pipeline.triggers.push(newTrigger);
      };

      this.removeExpectedArtifact = (pipeline, expectedArtifact) => {
        if (!pipeline.expectedArtifacts) {
          return;
        }

        pipeline.expectedArtifacts = pipeline.expectedArtifacts.filter(a => a.id !== expectedArtifact.id);

        if (!pipeline.triggers) {
          return;
        }

        pipeline.triggers.forEach(t => {
          if (t.expectedArtifactIds) {
            t.expectedArtifactIds = t.expectedArtifactIds.filter(eid => expectedArtifact.id !== eid);
          }
        });

        ArtifactReferenceService.removeReferenceFromStages(expectedArtifact.id, pipeline.stages);
      };

      this.addArtifact = () => {
        ExpectedArtifactService.addNewArtifactTo($scope.pipeline);
      };

      /**
       * PageNavigatorComponent relies on the ordering of items in the pages array of PageNavigationState.
       * PageNavigationState pages are registered in the init of each <page-section>.
       * Using <render-if-feature> / ng-if causes a <page-section> to init out of order with respect to html layout.
       * Alternatively, checkFeatureFlag allows for init to happen and for the <page-section> to check for visibilty.
       * https://github.com/spinnaker/spinnaker/issues/3970
       */

      this.checkFeatureFlag = flag => !!SETTINGS.feature[flag];

      $scope.addParameter = function() {
        if (!$scope.pipeline.parameterConfig) {
          $scope.pipeline.parameterConfig = [];
        }
        var newParameter = {
          name: '',
          label: '',
          required: false,
          pinned: false,
          description: '',
          default: '',
          hasOptions: false,
          options: [{ value: '' }],
        };
        $scope.pipeline.parameterConfig.push(newParameter);
        $scope.$digest();
      };

      $scope.removeParameter = function(index) {
        $scope.pipeline.parameterConfig.splice(index, 1);
        $scope.$digest();
      };

      $scope.updateParameter = function(index, changes) {
        $scope.pipeline.parameterConfig = $scope.pipeline.parameterConfig.slice(0);
        extend($scope.pipeline.parameterConfig[index], changes);
        $scope.$digest();
      };

      $scope.updateAllParameters = function(parameters) {
        $scope.$applyAsync(() => ($scope.pipeline.parameterConfig = parameters));
      };

      //Trigger Component
      $scope.removeTrigger = function(index) {
        $scope.$applyAsync(() => {
          $scope.pipeline.triggers.splice(index, 1);
          if (SETTINGS.feature['artifactsRewrite']) {
            $scope.removeUnusedExpectedArtifacts($scope.pipeline);
          }
        });
      };

      $scope.updateTrigger = function(index, updatedTrigger) {
        $scope.$applyAsync(() => {
          $scope.pipeline.triggers = $scope.pipeline.triggers.slice(0);
          $scope.pipeline.triggers[index] = updatedTrigger;
          PipelineConfigValidator.validatePipeline($scope.pipeline);
          if (SETTINGS.feature['artifactsRewrite']) {
            $scope.removeUnusedExpectedArtifacts($scope.pipeline);
          }
        });
      };

      //Expected Artifacts
      $scope.updateExpectedArtifacts = function(expectedArtifacts) {
        $scope.$applyAsync(() => {
          $scope.pipeline.expectedArtifacts = expectedArtifacts;
        });
      };

      $scope.removeUnusedExpectedArtifacts = function(pipeline) {
        // remove unused expected artifacts from the pipeline
        const artifacts = pipeline.expectedArtifacts || [];
        artifacts.forEach(artifact => {
          if (!pipeline.triggers.find(t => t.expectedArtifactIds && t.expectedArtifactIds.includes(artifact.id))) {
            pipeline.expectedArtifacts.splice(pipeline.expectedArtifacts.indexOf(artifact), 1);
            if (pipeline.expectedArtifacts.length === 0) {
              delete pipeline.expectedArtifacts;
            }
          }
          ArtifactReferenceService.removeReferenceFromStages(artifact.id, pipeline.stages);
        });
      };

      $scope.updateRoles = function(roles) {
        $scope.pipeline.roles = roles;
        $scope.$digest();
      };

      $scope.updateNotifications = function(notifications) {
        $scope.pipeline.notifications = notifications;
        $scope.$digest();
      };
    },
  ]);
