package ch.colixo.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setSupportZoom(false);
        settings.setTextZoom(100);
        // Ajouter ColixoApp au user agent pour que les pages détectent l'app native
        String ua = settings.getUserAgentString();
        settings.setUserAgentString(ua + " ColixoApp");
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);
        webView.setWebViewClient(new BridgeWebViewClient(getBridge()));
    }
}
