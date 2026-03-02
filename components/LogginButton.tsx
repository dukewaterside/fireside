import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useFonts, Inter_400Regular } from '@expo-google-fonts/inter';

interface LogginButtonProps {
    onPress: () => void;
    label: string;
    backgroundColor?: string;
}

export const LogginButton = ({onPress, label, backgroundColor = '#f2681c'}: LogginButtonProps) => {
    const [fontsLoaded] = useFonts({
        Inter_400Regular,
    });

    // Always render the button so it's clickable; use system font until Inter loads
    return (
        <TouchableOpacity 
            style={[styles.button, { backgroundColor }]} 
            onPress={onPress}
            activeOpacity={0.8}
        >
            <Text style={[styles.text, !fontsLoaded && styles.textFallback]}>{label}</Text>
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: '#f2681c',
        paddingVertical: 14,
        paddingHorizontal: 20,
        marginVertical: 8,
        width: '100%',
        maxWidth: 300,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    text: {
        color: 'white',
        fontSize: 16,
        fontFamily: 'Inter_400Regular',
        letterSpacing: 0.5,
    },
    textFallback: {
        fontFamily: undefined,
    },
})