package com.galerows.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallState;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;
import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "PlayStore")
public class PlayStorePlugin extends Plugin {
    private static final int FLEXIBLE_UPDATE_REQUEST_CODE = 7301;
    private static final int IMMEDIATE_UPDATE_REQUEST_CODE = 7302;

    private AppUpdateManager appUpdateManager;
    private InstallStateUpdatedListener installStateUpdatedListener;

    @Override
    public void load() {
        appUpdateManager = AppUpdateManagerFactory.create(getContext());
        installStateUpdatedListener = this::notifyInstallState;
    }

    @Override
    protected void handleOnDestroy() {
        unregisterInstallListener();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        appUpdateManager.getAppUpdateInfo()
            .addOnSuccessListener(appUpdateInfo -> call.resolve(toUpdateInfo(appUpdateInfo)))
            .addOnFailureListener(error -> call.reject("Unable to check Play Store update availability.", error));
    }

    @PluginMethod
    public void startFlexibleUpdate(PluginCall call) {
        startUpdate(call, AppUpdateType.FLEXIBLE, FLEXIBLE_UPDATE_REQUEST_CODE);
    }

    @PluginMethod
    public void startImmediateUpdate(PluginCall call) {
        startUpdate(call, AppUpdateType.IMMEDIATE, IMMEDIATE_UPDATE_REQUEST_CODE);
    }

    @PluginMethod
    public void completeFlexibleUpdate(PluginCall call) {
        appUpdateManager.completeUpdate()
            .addOnSuccessListener(unused -> {
                JSObject result = new JSObject();
                result.put("completed", true);
                call.resolve(result);
            })
            .addOnFailureListener(error -> call.reject("Unable to complete Play Store update.", error));
    }

    @PluginMethod
    public void requestInAppReview(PluginCall call) {
        ReviewManager reviewManager = ReviewManagerFactory.create(getContext());
        Task<ReviewInfo> request = reviewManager.requestReviewFlow();
        request.addOnCompleteListener(task -> {
            if (!task.isSuccessful()) {
                call.reject("Unable to request Play Store review flow.", task.getException());
                return;
            }

            Task<Void> flow = reviewManager.launchReviewFlow(getActivity(), task.getResult());
            flow.addOnCompleteListener(flowTask -> {
                JSObject result = new JSObject();
                result.put("attempted", true);
                call.resolve(result);
            });
        });
    }

    @PluginMethod
    public void openPlayStoreListing(PluginCall call) {
        String packageName = getContext().getPackageName();
        try {
            Intent marketIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + packageName));
            marketIntent.setPackage("com.android.vending");
            marketIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(marketIntent);
        } catch (ActivityNotFoundException error) {
            Intent webIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + packageName));
            webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(webIntent);
        }

        JSObject result = new JSObject();
        result.put("opened", true);
        call.resolve(result);
    }

    private void startUpdate(PluginCall call, int appUpdateType, int requestCode) {
        appUpdateManager.getAppUpdateInfo()
            .addOnSuccessListener(appUpdateInfo -> {
                if (!appUpdateInfo.isUpdateTypeAllowed(appUpdateType)) {
                    JSObject result = new JSObject();
                    result.put("started", false);
                    call.resolve(result);
                    return;
                }

                if (appUpdateType == AppUpdateType.FLEXIBLE) registerInstallListener();

                try {
                    boolean started = appUpdateManager.startUpdateFlowForResult(
                        appUpdateInfo,
                        getActivity(),
                        AppUpdateOptions.newBuilder(appUpdateType).build(),
                        requestCode
                    );
                    JSObject result = new JSObject();
                    result.put("started", started);
                    call.resolve(result);
                } catch (Exception error) {
                    if (appUpdateType == AppUpdateType.FLEXIBLE) unregisterInstallListener();
                    call.reject("Unable to start Play Store update flow.", error);
                }
            })
            .addOnFailureListener(error -> call.reject("Unable to start Play Store update flow.", error));
    }

    private JSObject toUpdateInfo(AppUpdateInfo appUpdateInfo) {
        JSObject result = new JSObject();
        int updateAvailability = appUpdateInfo.updateAvailability();
        int installStatus = appUpdateInfo.installStatus();
        Integer stalenessDays = appUpdateInfo.clientVersionStalenessDays();

        result.put("available", updateAvailability == UpdateAvailability.UPDATE_AVAILABLE);
        result.put("developerTriggeredUpdateInProgress", updateAvailability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS);
        result.put("flexibleAllowed", appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE));
        result.put("immediateAllowed", appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE));
        result.put("updatePriority", appUpdateInfo.updatePriority());
        result.put("clientVersionStalenessDays", stalenessDays);
        result.put("availableVersionCode", appUpdateInfo.availableVersionCode());
        result.put("installStatus", installStatus);
        result.put("downloaded", installStatus == InstallStatus.DOWNLOADED);
        return result;
    }

    private void notifyInstallState(InstallState state) {
        JSObject result = new JSObject();
        result.put("installStatus", state.installStatus());
        result.put("bytesDownloaded", state.bytesDownloaded());
        result.put("totalBytesToDownload", state.totalBytesToDownload());
        result.put("downloaded", state.installStatus() == InstallStatus.DOWNLOADED);
        notifyListeners("updateStateChanged", result);
    }

    private void registerInstallListener() {
        appUpdateManager.registerListener(installStateUpdatedListener);
    }

    private void unregisterInstallListener() {
        if (appUpdateManager != null && installStateUpdatedListener != null) {
            appUpdateManager.unregisterListener(installStateUpdatedListener);
        }
    }
}
