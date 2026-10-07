import { setStringAsync } from 'expo-clipboard'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { Image } from 'expo-image'
import { t } from 'i18next'
import JSZip from 'jszip'
import { RaTeXView } from 'ratex-react-native'
import React, { ReactNode, useCallback, useMemo, useState } from 'react'
import { Platform, StyleSheet, Text, useWindowDimensions, View, useColorScheme } from 'react-native'
import { MarkdownIt } from 'react-native-markdown-display'

import ThemedButton from '@components/buttons/ThemedButton'
import Accordion from '@components/views/Accordion'
import { ChatStyle } from '@lib/state/ChatStyle'
import { Logger } from '@lib/state/Logger'
import { Theme } from '@lib/theme/ThemeManager'

import latexPlugin from './MarkdownLatexPlugin'
import doubleQuotePlugin from './MarkdownQuotePlugin'
import thinkPlugin from './MarkdownThinkPlugin'

// --- ДОБАВЛЕНО: Встроенный хайлайтер кода, не требующий установки дополнительных библиотек ---
const CodeHighlighter = ({ code }: { code: string }) => {
    const isDark = useColorScheme() === 'dark';
    
    // Цветовая палитра в стиле Atom One (Dark/Light)
    const colors = isDark ? {
        keyword: '#c678dd', // Фиолетовый
        string: '#98c379',  // Зеленый
        number: '#d19a66',  // Оранжевый
        comment: '#5c6370', // Серый
        func: '#61afef',    // Голубой
        text: '#abb2bf',    // Обычный текст
    } : {
        keyword: '#a626a4',
        string: '#50a14f',
        number: '#986801',
        comment: '#a0a1a7',
        func: '#4078f2',
        text: '#383a42',
    };

    // Универсальное регулярное выражение для парсинга базового синтаксиса
    const regex = /(["'](?:\\.|[^\\])*?["'])|(\b(?:def|class|import|from|return|if|else|elif|for|while|in|const|let|var|function|async|await|print|echo|new|try|catch|True|False|true|false|null|None)\b)|(\b\d+(?:\.\d+)?\b)|(#.*|\/\/.*)|(\b[a-zA-Z_]\w*(?=\s*\())/g;

    let lastIndex = 0;
    const elements: ReactNode[] = [];
    let match;

    while ((match = regex.exec(code)) !== null) {
        // Обычный текст до найденного элемента
        if (match.index > lastIndex) {
            elements.push(<Text key={`text-${lastIndex}`} style={{ color: colors.text }}>{code.substring(lastIndex, match.index)}</Text>);
        }

        // Определение цвета в зависимости от найденной группы
        let color = colors.text;
        if (match[1]) color = colors.string;
        else if (match[2]) color = colors.keyword;
        else if (match[3]) color = colors.number;
        else if (match[4]) color = colors.comment;
        else if (match[5]) color = colors.func;

        elements.push(<Text key={`match-${match.index}`} style={{ color }}>{match[0]}</Text>);
        lastIndex = regex.lastIndex;
    }

    // Добавляем оставшийся текст после последнего совпадения
    if (lastIndex < code.length) {
        elements.push(<Text key={`text-${lastIndex}`} style={{ color: colors.text }}>{code.substring(lastIndex)}</Text>);
    }

    return <Text>{elements}</Text>;
}
// --- КОНЕЦ ДОБАВЛЕНИЯ ---

// --- ДОБАВЛЕНО: Интеллектуальный блок кода с поддержкой ZIP-архивации ---
const EnhancedCodeFence = ({ node, content, sourceInfo, styles, inheritedStyles }: any) => {
    const language = sourceInfo ? sourceInfo.trim() : 'text';

    const handleDownloadZip = async () => {
        try {
            Logger.infoToast('Упаковка архива...');
            const zip = new JSZip();

            let ext = 'txt';
            if (language === 'python') ext = 'py';
            else if (language === 'javascript' || language === 'js') ext = 'js';
            else if (language === 'java') ext = 'java';
            else if (language === 'html') ext = 'html';
            else if (language === 'dart') ext = 'dart';
            else if (language === 'json') ext = 'json';
            else if (language === 'cpp' || language === 'c++') ext = 'cpp';
            else if (language === 'sh' || language === 'bash') ext = 'sh';
            else if (language === 'ts' || language === 'typescript') ext = 'ts';

            const fileName = `source_${language}.${ext}`;
            zip.file(fileName, content);

            const base64Data = await zip.generateAsync({ type: 'base64' });
            const fileUri = FileSystem.cacheDirectory + `${language}_code.zip`;

            await FileSystem.writeAsStringAsync(fileUri, base64Data, {
                encoding: FileSystem.EncodingType.Base64,
            });

            await Sharing.shareAsync(fileUri, {
                mimeType: 'application/zip',
                dialogTitle: 'Сохранить исходный код',
            });
        } catch (error) {
            Logger.errorToast('Ошибка сохранения');
        }
    };

    return (
        <View key={node.key} style={{ marginBottom: styles.fence.marginBottom }}>
            {/* Заголовок блока с кнопкой копирования */}
            <View style={[styles.fenceHeader, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
                <Text style={{ color: styles.fenceHeader.color, fontWeight: 'bold' }}>
                    {sourceInfo || 'Code'}
                </Text>
                {content && (
                    <ThemedButton
                        iconName="copy"
                        variant="tertiary"
                        iconStyle={{ color: styles.fenceHeader.color }}
                        onPress={() => {
                            setStringAsync(content)
                                .then(() => {
                                    Logger.infoToast(t('chat.quickActions.toast.copiedCode'))
                                })
                                .catch(() => {
                                    Logger.errorToast(t('chat.quickActions.toast.copyFailed'))
                                })
                        }}
                    />
                )}
            </View>
            
            {/* Блок с раскрашенным кодом */}
            <Text style={[inheritedStyles, styles.fence, { marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 }]}>
                <CodeHighlighter code={content} />
            </Text>

            {/* Подвал-карточка для скачивания архива */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: styles.fenceHeader.backgroundColor,
                borderWidth: styles.fence.borderWidth,
                borderColor: styles.fence.borderColor,
                borderTopWidth: 0,
                borderBottomLeftRadius: styles.fence.borderBottomLeftRadius,
                borderBottomRightRadius: styles.fence.borderBottomRightRadius,
                paddingHorizontal: 16,
                paddingVertical: 10,
            }}>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: styles.fenceHeader.color, fontWeight: 'bold', fontSize: 14 }}>
                        {`${language}_code.zip`}
                    </Text>
                    <Text style={{ color: styles.fenceHeader.color, opacity: 0.7, fontSize: 12, marginTop: 2 }}>
                        ZIP Archive • {(content.length / 1024).toFixed(1)} KB
                    </Text>
                </View>
                <ThemedButton
                    iconName="download"
                    variant="tertiary"
                    iconStyle={{ color: styles.fenceHeader.color }}
                    onPress={handleDownloadZip}
                />
            </View>
        </View>
    );
};
// --- КОНЕЦ ДОБАВЛЕНИЯ ---

const getDeepASTDirection = (astNode: any): 'ltr' | 'rtl' | 'neutral' => {
    if (!astNode) return 'neutral'

    if (
        astNode.type === 'softbreak' ||
        astNode.type === 'hardbreak' ||
        astNode.type === 'double_quote'
    ) {
        return 'neutral'
    }

    if (astNode.type === 'text' && typeof astNode.content === 'string') {
        if (!astNode.content.trim()) return 'neutral'
        const rtlRegex = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/
        return rtlRegex.test(astNode.content) ? 'rtl' : 'ltr'
    }

    if (Array.isArray(astNode.children)) {
        for (const childNode of astNode.children) {
            const dir = getDeepASTDirection(childNode)
            if (dir !== 'neutral') return dir
        }
    }

    return 'neutral'
}

const ImageAdapter = ({
    node,
    children,
    parent,
    styles,
    allowedImageHandlers,
    defaultImageHandler,
}: {
    node: any
    children: any
    parent: any
    styles: any
    allowedImageHandlers: any
    defaultImageHandler: any
}) => {
    const [imageData, setImageData] = useState({ height: 0, aspectRatio: 1 })
    const { src, alt } = node.attributes

    const { width } = useWindowDimensions()
    const show =
        allowedImageHandlers.filter((value: string) => {
            return src.toLowerCase().startsWith(value.toLowerCase())
        }).length > 0

    if (show === false && defaultImageHandler === null) {
        return null
    }

    const imageProps: any = {
        indicator: true,
        style: styles._VIEW_SAFE_image,
        source: { uri: src },
    }

    if (alt) {
        imageProps.accessible = true
        imageProps.accessibilityLabel = alt
    }

    return (
        <View style={{ height: imageData.height }}>
            <Image
                key={node.key}
                {...imageProps}
                width={imageData.height}
                aspectRatio={imageData.aspectRatio}
                onLoad={(data) => {
                    setImageData({
                        height: Math.min(width - 100, data.source.width),
                        aspectRatio: data.source.width / data.source.height,
                    })
                }}
                contentFit="contain"
            />
        </View>
    )
}

export namespace MarkdownStyle {
    export const Rules = MarkdownIt({ typographer: true })
        .use(thinkPlugin)
        .use(doubleQuotePlugin)
        .use(latexPlugin)

    export const RenderRules: Record<string, (...props: any) => ReactNode> = {
        fence: (node: any, children: any, parent: any, styles: any, inheritedStyles = {}) => {
            let { content, sourceInfo } = node
            if (
                typeof node.content === 'string' &&
                node.content.charAt(node.content.length - 1) === '\n'
            ) {
                content = node.content.substring(0, node.content.length - 1)
            }
            return (
                <EnhancedCodeFence
                    key={node.key}
                    node={node}
                    content={content}
                    sourceInfo={sourceInfo}
                    styles={styles}
                    inheritedStyles={inheritedStyles}
                />
            )
        },
        double_quote: (node: any, children: any, parent: any, styles: any) => {
            const quotes = {
                english: ['“', '”'],
                low9: ['„', '”'],
                reversed9: ['‟', '”'],
                ascii: ['"', '"'],
                guillemet: ['«', '»'],
            }

            const quoteType = (node.sourceMeta?.quoteType ??
                node.meta?.quoteType ??
                'english') as keyof typeof quotes
            let [open, close] = quotes[quoteType] || quotes.english
            if (node.sourceMeta?.dangling) close = ''
            return (
                <Text key={node.key} style={styles.double_quote}>
                    {open}
                    {children}
                    {close}
                </Text>
            )
        },
        think: (node: any, children: any, parent: any, styles: any) => {
            return (
                <Accordion
                    key={node.key}
                    label={node.sourceInfo ? 'Thought Process' : 'Thinking...'}
                    style={{
                        flex: 1,
                        marginBottom: 8,
                        elevation: 8,
                    }}>
                    {children}
                </Accordion>
            )
        },
        latex_block: (node: any, children: any, parent: any, styles: any) => {
            const { content } = node
            return (
                <RaTeXView
                    latex={content ?? ''}
                    key={node.key}
                    style={styles.latex_block}
                    color={styles.latex_block.color ?? 'white'}
                />
            )
        },
        latex_inline: (node: any, children: any, parent: any, styles: any) => {
            const { content } = node
            return (
                <RaTeXView
                    latex={content ?? ''}
                    key={node.key}
                    style={styles.latex_block}
                    color={styles.latex_block.color ?? 'white'}
                />
            )
        },

        textgroup: (node: any, children: any, parent: any, styles: any) => {
            const astChildrenArray = node.children || []
            const renderedChildrenArray = React.Children.toArray(children)

            const componentRuns: any[] = []
            let currentRunAst: any[] = []
            let currentRunRendered: any[] = []

            let currentDir: 'ltr' | 'rtl' = 'ltr'
            let isFirstNode = true
            astChildrenArray.forEach((astChild: any, index: number) => {
                const renderedChild = renderedChildrenArray[index]
                if (!renderedChild) return

                let childDir = getDeepASTDirection(astChild)

                if (childDir === 'neutral') {
                    childDir = currentDir
                }

                if (isFirstNode) {
                    currentDir = childDir
                    isFirstNode = false
                    currentRunAst.push(astChild)
                    currentRunRendered.push(renderedChild)
                } else if (childDir === currentDir) {
                    currentRunAst.push(astChild)
                    currentRunRendered.push(renderedChild)
                } else {
                    componentRuns.push({
                        direction: currentDir,
                        renderedChildren: currentRunRendered,
                    })
                    currentDir = childDir
                    currentRunAst = [astChild]
                    currentRunRendered = [renderedChild]
                }
            })

            if (currentRunRendered.length > 0) {
                componentRuns.push({
                    direction: currentDir,
                    renderedChildren: currentRunRendered,
                })
            }

            return (
                <View key={node.key} style={{ width: '100%', flexWrap: 'wrap' }}>
                    {componentRuns.map((run, index) => {
                        const isRtl = run.direction === 'rtl'

                        return (
                            <Text
                                key={`run-${index}`}
                                style={[
                                    styles.textgroup,
                                    {
                                        flexWrap: 'wrap',
                                        width: '100%',
                                        writingDirection: run.direction,
                                        textAlign: isRtl ? 'right' : 'left',
                                    },
                                ]}>
                                {isRtl ? '\u2067' : '\u2066'}
                                {run.renderedChildren}
                                {'\u2069'}
                            </Text>
                        )
                    })}
                </View>
            )
        },
        inline: (node: any, children: any, parent: any, styles: any) => {
            return (
                <Text key={node.key} style={[styles.inline, { flexWrap: 'wrap', width: '100%' }]}>
                    {children}
                </Text>
            )
        },
        image: (
            node: any,
            children: any,
            parent: any,
            styles: any,
            allowedImageHandlers: any,
            defaultImageHandler: any
        ) => {
            return (
                <ImageAdapter
                    key={node.key}
                    node={node}
                    parent={parent}
                    styles={styles}
                    allowedImageHandlers={allowedImageHandlers}
                    defaultImageHandler={defaultImageHandler}>
                    {children}
                </ImageAdapter>
            )
        },
    }

    export const useCustomFormatting = () => {
        const mdStyle = useMarkdownStyle()

        const { markdown, rules, style } = useMemo(
            () => ({
                markdown: Rules,
                rules: RenderRules,
                style: mdStyle,
            }),
            [mdStyle]
        )
        return { markdown, rules, style }
    }

    export const useMarkdownStyle = () => {
        const { color, spacing, borderRadius } = Theme.useTheme()
        const { fontSize, textWeight } = ChatStyle.useChatStyle()

        const getModifiedFontSize = useCallback(
            (size: number) =>
                Math.max(ChatStyle.MIN_FONT_SIZE, ChatStyle.sizeModifierMap[fontSize] + size),
            [fontSize]
        )

        const getModifiedFontWeight = useCallback(
            (weight: number) => {
                const newWeight = Math.max(
                    200,
                    Math.min(900, weight + (ChatStyle.weightModifierMap?.[textWeight] ?? 0))
                )
                return `${newWeight}` as any
            },
            [textWeight]
        )

        return useMemo(
            () =>
                StyleSheet.create({
                    double_quote: { color: color.quote },
                    body: {
                        textAlign: 'auto',
                    },
                    heading1: {
                        flexDirection: 'row',
                        fontSize: getModifiedFontSize(32),
                        color: color.text._100,
                        fontWeight: getModifiedFontWeight(500),
                    },
                    heading2: {
                        flexDirection: 'row',
                        fontSize: getModifiedFontSize(24),
                        color: color.text._100,
                        fontWeight: getModifiedFontWeight(500),
                    },
                    heading3: {
                        flexDirection: 'row',
                        fontSize: getModifiedFontSize(18),
                        color: color.text._100,
                        fontWeight: getModifiedFontWeight(500),
                    },
                    heading4: {
                        flexDirection: 'row',
                        fontSize: getModifiedFontSize(16),
                        color: color.text._100,
                        fontWeight: getModifiedFontWeight(500),
                    },
                    heading5: {
                        flexDirection: 'row',
                        fontSize: getModifiedFontSize(13),
                        color: color.text._100,
                        fontWeight: getModifiedFontWeight(500),
                    },
                    heading6: {
                        flexDirection: 'row',
                        fontSize: getModifiedFontSize(11),
                        color: color.text._100,
                        fontWeight: getModifiedFontWeight(500),
                    },
                    hr: {
                        backgroundColor: color.primary._500,
                        height: 1,
                        marginTop: spacing.m,
                    },
                    strong: {
                        fontWeight: getModifiedFontWeight(700),
                        color: color.text._100,
                    },
                    em: {
                        fontStyle: 'italic',
                        color: color.text._400,
                    },
                    s: {
                        textDecorationLine: 'line-through',
                        color: color.text._400,
                    },
                    blockquote: {
                        backgroundColor: color.neutral._200,
                        borderColor: color.primary._500,
                        borderLeftWidth: 4,
                        marginLeft: spacing.sm,
                        paddingHorizontal: spacing.sm,
                        color: color.text._400,
                    },
                    bullet_list: {
                        marginVertical: spacing.sm,
                    },
                    ordered_list: {
                        marginVertical: spacing.sm,
                    },
                    list_item: {
                        flexDirection: 'row',
                        justifyContent: 'flex-start',
                        color: color.text._100,
                    },
                    bullet_list_icon: {
                        color: color.text._400,
                        marginLeft: spacing.m,
                        marginRight: spacing.m,
                    },
                    bullet_list_content: {
                        flex: 1,
                    },
                    ordered_list_icon: {
                        color: color.text._400,
                        marginLeft: spacing.m,
                        marginRight: spacing.m,
                    },
                    ordered_list_content: {
                        flex: 1,
                    },
                    code_inline: {
                        backgroundColor: color.neutral._200,
                        paddingHorizontal: spacing.m,
                        flex: 1,
                        borderRadius: 4,
                        ...Platform.select({
                            ios: {
                                fontFamily: 'Courier',
                            },
                            android: {
                                fontFamily: 'monospace',
                            },
                        }),
                    },
                    code_block: {
                        color: color.text._400,
                        borderWidth: 1,
                        borderColor: color.neutral._100,
                        backgroundColor: color.neutral._200,
                        padding: 4,
                        borderRadius: 8,
                        ...Platform.select({
                            ios: {
                                fontFamily: 'Courier',
                            },
                            android: {
                                fontFamily: 'monospace',
                            },
                        }),
                    },
                    fence: {
                        color: color.text._300,
                        backgroundColor: color.neutral._100,
                        borderColor: color.neutral._200,
                        borderWidth: 2,
                        paddingLeft: spacing.l,
                        paddingRight: spacing.l,
                        paddingVertical: spacing.m,
                        marginBottom: spacing.m,
                        borderBottomLeftRadius: borderRadius.m,
                        borderBottomRightRadius: borderRadius.m,
                        ...Platform.select({
                            ios: {
                                fontFamily: 'Courier',
                            },
                            android: {
                                fontFamily: 'monospace',
                            },
                        }),
                    },
                    fenceHeader: {
                        color: color.text._300,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 4,
                        paddingHorizontal: 12,
                        backgroundColor: color.neutral._200,
                        borderTopLeftRadius: borderRadius.m,
                        borderTopRightRadius: borderRadius.m,
                        marginTop: spacing.sm,
                    },
                    table: {
                        borderWidth: 2,
                        borderColor: color.neutral._300,
                        borderRadius: borderRadius.m,
                        marginBottom: spacing.m,
                        overflow: 'hidden',
                    },
                    thead: {
                        backgroundColor: color.neutral._300,
                    },
                    tbody: {
                        backgroundColor: color.neutral._200,
                    },
                    th: {
                        flex: 1,
                        padding: 8,
                    },
                    tr: {
                        borderBottomWidth: 1,
                        borderColor: color.neutral._300,
                        flexDirection: 'row',
                        fontSize: getModifiedFontSize(14),
                    },
                    td: {
                        flex: 1,
                        padding: 8,
                    },
                    link: {
                        textDecorationLine: 'underline',
                    },
                    blocklink: {
                        flex: 1,
                        borderColor: '#000000',
                        borderBottomWidth: 1,
                    },
                    image: {
                        flex: 1,
                        minWidth: 30,
                        minHeight: 30,
                    },
                    text: {},
                    textgroup: {
                        fontWeight: getModifiedFontWeight(400),
                        color: color.text._100,
                        width: '100%',
                    },
                    latex_inline: {
                        color: color.text._300,
                        fontSize: getModifiedFontSize(16),
                    },
                    latex_block: {
                        color: color.text._300,
                        fontSize: getModifiedFontSize(16),
                        marginTop: spacing.l,
                        marginBottom: spacing.sm,
                    },
                    paragraph: {
                        flexWrap: 'wrap',
                        textAlign: 'auto',
                        color: color.text._100,
                        marginVertical: spacing.sm,
                        fontSize: getModifiedFontSize(14),
                    },
                    hardbreak: {
                        width: '100%',
                        height: 1,
                        color: color.text._100,
                    },
                    softbreak: {},
                    pre: {},
                    inline: {},
                    span: {},
                }),
            [color, spacing, borderRadius, getModifiedFontSize, getModifiedFontWeight]
        )
    }
}
