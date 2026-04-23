import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useListProfiles, useCreateProfile } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";

interface Profile {
  id: number;
  name: string;
  isDefault: boolean;
  status: "active" | "archived";
}

interface ProfileContextType {
  activeProfileId: number | null;
  setActiveProfileId: (id: number) => void;
  profiles: Profile[];
  isLoading: boolean;
  needsOnboarding: boolean;
  needsProfileSelection: boolean;
  createProfile: (name: string) => Promise<void>;
  isCreating: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded: isUserLoaded } = useUser();
  const [activeProfileId, setActiveProfileIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem("finagent_profile_id");
    return saved ? parseInt(saved, 10) : null;
  });

  const { data: profiles = [], isLoading: isLoadingProfiles } = useListProfiles({
    query: { enabled: isUserLoaded && !!user },
  });

  const createProfileMutation = useCreateProfile();

  const setActiveProfileId = (id: number) => {
    setActiveProfileIdState(id);
    localStorage.setItem("finagent_profile_id", id.toString());
  };

  // Auto-select only when there is exactly ONE active profile and nothing is stored
  useEffect(() => {
    if (!isUserLoaded || !user) return;
    const activeProfiles = profiles.filter(p => p.status !== "archived");
    if (activeProfiles.length === 1 && !activeProfileId) {
      setActiveProfileId(activeProfiles[0].id);
    }
  }, [isUserLoaded, user, profiles, activeProfileId]);

  // Clear stored profile if it no longer exists OR became archived
  useEffect(() => {
    if (!isUserLoaded || !user || !activeProfileId) return;
    if (profiles.length === 0) return;
    const current = profiles.find(p => p.id === activeProfileId);
    if (!current || current.status === "archived") {
      setActiveProfileIdState(null);
      localStorage.removeItem("finagent_profile_id");
    }
  }, [isUserLoaded, user, profiles, activeProfileId]);

  const createProfile = async (name: string): Promise<void> => {
    const profile = await createProfileMutation.mutateAsync({
      data: { name, isDefault: true },
    });
    setActiveProfileId(profile.id);
  };

  const isLoading = !isUserLoaded || isLoadingProfiles;
  const needsOnboarding = isUserLoaded && !!user && !isLoadingProfiles && profiles.length === 0;
  // Must select explicitly when >1 profile and none is currently active
  const needsProfileSelection =
    isUserLoaded &&
    !!user &&
    !isLoadingProfiles &&
    profiles.length > 1 &&
    !activeProfileId;

  return (
    <ProfileContext.Provider value={{
      activeProfileId,
      setActiveProfileId,
      profiles: profiles as Profile[],
      isLoading,
      needsOnboarding,
      needsProfileSelection,
      createProfile,
      isCreating: createProfileMutation.isPending,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}
