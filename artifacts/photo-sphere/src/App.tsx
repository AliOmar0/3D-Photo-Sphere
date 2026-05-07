import { Router, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { Hub } from "@/pages/Hub";
import { PhotoSphereApp } from "@/pages/PhotoSphereApp";
import { PuzzlePage } from "@/pages/PuzzlePage";
import { ParticlesPage } from "@/pages/ParticlesPage";
import { DrawPage } from "@/pages/DrawPage";
import { SkeletonPage } from "@/pages/SkeletonPage";
import { HudPage } from "@/pages/HudPage";
import NotFound from "@/pages/not-found";

function App() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={Hub} />
        <Route path="/sphere" component={PhotoSphereApp} />
        <Route path="/puzzle" component={PuzzlePage} />
        <Route path="/particles" component={ParticlesPage} />
        <Route path="/draw" component={DrawPage} />
        <Route path="/skeleton" component={SkeletonPage} />
        <Route path="/hud" component={HudPage} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

export default App;
