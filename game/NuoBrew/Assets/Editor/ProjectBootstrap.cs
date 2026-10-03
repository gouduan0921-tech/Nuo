using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;

namespace NuoBrew.EditorTools
{
    public static class ProjectBootstrap
    {
        const string ScenePath = "Assets/Presentation/Scenes/yard.unity";

        public static void CreateYardScene()
        {
            Directory.CreateDirectory("Assets/Presentation/Scenes");
            var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[]
            {
                new EditorBuildSettingsScene(ScenePath, true)
            };
            PlayerSettings.companyName = "NuoBrew";
            PlayerSettings.productName = "NuoBrew";
            AssetDatabase.SaveAssets();
        }
    }
}
